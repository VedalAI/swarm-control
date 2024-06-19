import { RowDataPacket } from "mysql2";
import mysql from "mysql2/promise";
import { IdentifiableCart } from "common/types";
import { v4 as uuid } from "uuid";
import { User } from "../modules/transactions/user";

export let db: mysql.Connection;

export async function initDb() {
    if (!process.env.MYSQL_HOST) {
        console.warn("No MYSQL_HOST specified (assuming local testing/development), skipping database setup");
        return;
    }
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

export async function setupDb() {
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
        CREATE TABLE IF NOT EXISTS transactions (
            receipt VARCHAR(1024) PRIMARY KEY,
            token VARCHAR(255) NOT NULL,
            userId VARCHAR(255) NOT NULL
        );
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS prepurchases (
            token VARCHAR(255) PRIMARY KEY,
            cart JSON NOT NULL,
            userId VARCHAR(255) NOT NULL
        );
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS logs (
            id INT PRIMARY KEY AUTO_INCREMENT,
            userId VARCHAR(255),
            transactionToken VARCHAR(255),
            data TEXT NOT NULL,
            fromBackend BOOLEAN NOT NULL,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);
}

export async function isReceiptUsed(receipt: string): Promise<boolean> {
    try {
        const [rows] = (await db.query("SELECT COUNT(*) FROM transactions WHERE receipt = ?", [receipt])) as [RowDataPacket[], any];
        return rows[0]["COUNT(*)"] != 0;
    } catch (e: any) {
        console.error("Database query failed (isReceiptUsed)");
        console.error(e);
        throw e;
    }
}

export async function addFulfilledTransaction(receipt: string, token: string, userId: string) {
    try {
        await db.query("INSERT INTO transactions (receipt, token, userId) VALUES (?, ?, ?)", [receipt, token, userId]);
        await db.query("DELETE FROM prepurchases WHERE token = ?", [token]);
    } catch (e: any) {
        console.error("Database query failed (addFulfilledTransaction)");
        console.error(e);
        throw e;
    }
}

export async function registerPrepurchase(cart: IdentifiableCart): Promise<string> {
    try {
        const token = uuid();
        await db.query("INSERT INTO prepurchases (token, cart, userId) VALUES (?, ?, ?)", [token, JSON.stringify(cart), cart.userId]);
        return token;
    } catch (e: any) {
        console.error("Database query failed (registerPrepurchase)");
        console.error(e);
        throw e;
    }
}

export async function getPrepurchase(token: string): Promise<IdentifiableCart | undefined> {
    try {
        const [rows] = (await db.query("SELECT cart FROM prepurchases WHERE token = ?", [token])) as [RowDataPacket[], any];
        if (rows.length === 0) return undefined;
        return rows[0].cart as IdentifiableCart;
    } catch (e: any) {
        console.error("Database query failed (isPrepurchaseValid)");
        console.error(e);
        throw e;
    }
}

export async function deletePrepurchase(token: string) {
    try {
        await db.query("DELETE FROM prepurchases WHERE token = ?", [token]);
    } catch (e: any) {
        console.error("Database query failed (deletePrepurchase)");
        console.error(e);
        throw e;
    }
}

const emptyUser: User = {
    id: "",
    credit: 0,
    banned: false
};

export async function getUser(id: string): Promise<User> {
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
        ...emptyUser,
        id
    };
    await saveUser(user);
    return user;
}

export async function saveUser(user: User) {
    try {
        await db.query("INSERT INTO users (id, login, displayName, credit, banned)"
            + " VALUES (:id, :login, :displayName, :credit, :banned)"
            + " ON DUPLICATE KEY UPDATE login=:login, displayName=:displayName, credit=:credit, banned=:banned",
            {...user});
    } catch (e: any) {
        console.error("Database query failed (saveUser)");
        console.error(e);
        throw e;
    }
}
