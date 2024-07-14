import { RowDataPacket } from "mysql2";
import mysql from "mysql2/promise";
import { v4 as uuid } from "uuid";
import { User, Order, Cart } from "common/types";
import { getTwitchUser } from "../modules/twitch";

export let db: mysql.Connection;

export async function initDb() {
    while (!db) {
        try {
            db = await mysql.createConnection({
                host: process.env.MYSQL_HOST,
                user: process.env.MYSQL_USER,
                password: process.env.MYSQL_PASSWORD,
                database: process.env.MYSQL_DATABASE,
                namedPlaceholders: true,
            });
        } catch {
            console.log("Failed to connect to database. Retrying in 1 second...");
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
    }
}

export async function getOrder(guid: string) {
    try {
        const [rows] = (await db.query("SELECT * FROM orders WHERE id = ?", [guid])) as [RowDataPacket[], any];
        if (!rows.length) {
            return null;
        }
        return rows[0] as Order;
    } catch (e: any) {
        console.error("Database query failed (getOrder)");
        console.error(e);
        throw e;
    }
}

export async function createOrder(userId: string, cart: Cart) {
    const order: Order = {
        state: "rejected",
        cart,
        id: uuid(),
        userId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };
    try {
        await db.query(
            `INSERT INTO orders (id, userId, state, cart, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?)`,
            [order.id, order.userId, order.state, JSON.stringify(order.cart), order.createdAt, order.updatedAt]
        );
        return order;
    } catch (e: any) {
        console.error("Database query failed (createOrder)");
        console.error(e);
        throw e;
    }
}

export async function saveOrder(order: Order) {
    order.updatedAt = Date.now();
    await db.query(
        `UPDATE orders
        SET state = ?, cart = ?, receipt = ?, result = ?, updatedAt = ?
        WHERE id = ?`,
        [order.state, JSON.stringify(order.cart), order.receipt, order.result, order.updatedAt, order.id]
    );
}

export async function getOrAddUser(id: string): Promise<User> {
    try {
        const [rows] = (await db.query("SELECT * FROM users WHERE id = ?", [id])) as [RowDataPacket[], any];
        if (!rows.length) {
            return await createUser(id);
        }
        return rows[0] as User;
    } catch (e: any) {
        console.error("Database query failed (getOrAddUser)");
        console.error(e);
        throw e;
    }
}

export async function lookupUser(idOrName: string): Promise<User | null> {
    try {
        const lookupStr = `%${idOrName}%`;
        const [rows] = (await db.query(
            `SELECT * FROM users
            WHERE id = :idOrName
            OR login LIKE :lookupStr
            OR displayName LIKE :lookupStr`,
            { idOrName, lookupStr }
        )) as [RowDataPacket[], any];
        if (!rows.length) {
            return null;
        }
        return rows[0] as User;
    } catch (e: any) {
        console.error("Database query failed (getUser)");
        console.error(e);
        throw e;
    }
}

async function createUser(id: string): Promise<User> {
    const user: User = {
        id,
        banned: false,
    };
    try {
        await db.query(
            `
            INSERT INTO users (id, login, displayName, banned)
            VALUES (:id, :login, :displayName, :banned)`,
            user
        );
    } catch (e: any) {
        console.error("Database query failed (createUser)");
        console.error(e);
        throw e;
    }
    return user;
}

export async function saveUser(user: User) {
    try {
        await db.query(
            `
            UPDATE users
            SET login = :login, displayName = :displayName, banned = :banned
            WHERE id = :id`,
            { ...user }
        );
    } catch (e: any) {
        console.error("Database query failed (saveUser)");
        console.error(e);
        throw e;
    }
}

export async function updateUserTwitchInfo(user: User): Promise<User> {
    try {
        user = {
            ...user,
            ...(await getTwitchUser(user.id)),
        };
    } catch (e: any) {
        console.error("Twitch API GetUsers call failed (updateUserTwitchInfo)");
        console.error(e);
        throw e;
    }
    try {
        await db.query(
            `
            UPDATE users
            SET login = :login, displayName = :displayName
            WHERE id = :id`,
            { ...user }
        );
    } catch (e: any) {
        console.error("Database query failed (updateUserTwitchInfo)");
        console.error(e);
        throw e;
    }
    return user;
}
