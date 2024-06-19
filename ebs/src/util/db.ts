import { RowDataPacket } from "mysql2";
import mysql from "mysql2/promise";
import { v4 as uuid } from "uuid";
import { Order } from "common/types";
import { User } from "common/types";

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
            console.log("Failed to connect to database. Retrying in 5 seconds...");
            await new Promise((resolve) => setTimeout(resolve, 5000));
        }
    }

    await setupDb();
}

async function setupDb() {
    await db.query(`
        CREATE TABLE IF NOT EXISTS users (
            id VARCHAR(255) PRIMARY KEY,
            login VARCHAR(255),
            displayName VARCHAR(255),
            credit INT,
            banned BOOLEAN
        );
    `);
    await db.query(`
        CREATE TABLE IF NOT EXISTS orders (
            id VARCHAR(36) PRIMARY KEY,
            userId VARCHAR(255) NOT NULL,
            state INT NOT NULL DEFAULT 0,
            cart JSON,
            receipt VARCHAR(1024),
            result TEXT,
            createdAt BIGINT,
            updatedAt BIGINT
        );
    `);
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

export async function createOrder(userId: string, initialState?: Omit<Partial<Order>, "id" | "userId" | "createdAt" | "updatedAt">) {
    const order: Order = {
        state: 0,
        ...initialState,
        id: uuid(),
        userId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };
    try {
        await db.query(`
            INSERT INTO orders (id, userId, state, cart, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?)`,
            [order.id, order.userId, order.state, JSON.stringify(order.cart), order.createdAt, order.updatedAt]);
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
        `
        UPDATE orders
        SET state = ?, cart = ?, receipt = ?, result = ?, updatedAt = ?
        WHERE id = ?
    `,
        [order.state, JSON.stringify(order.cart), order.receipt, order.receipt, order.updatedAt, order.id]
    );
}

export async function getOrAddUser(id: string): Promise<User> {
    try {
        const [rows] = (await db.query("SELECT * FROM users WHERE id = ?", [id])) as [RowDataPacket[], any];
        if (rows.length === 0) {
            return await createUser(id);
        }
        return rows[0] as User;
    } catch (e: any) {
        console.error("Database query failed (getUser)");
        console.error(e);
        throw e;
    }
}

async function createUser(id: string): Promise<User> {
    const user = {
        id,
        credit: 0,
        banned: false,
    };
    try {
        await db.query(
            `
            INSERT INTO users (id, login, displayName, credit, banned)
            VALUES (:id, :login, :displayName, :credit, :banned)`,
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
            SET login = :login, displayName = :displayName, credit = :credit, banned = :banned
            WHERE id = :id`,
            { ...user }
        );
    } catch (e: any) {
        console.error("Database query failed (saveUser)");
        console.error(e);
        throw e;
    }
}
