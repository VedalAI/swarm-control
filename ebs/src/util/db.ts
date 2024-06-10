import { RowDataPacket } from "mysql2";
import mysql from "mysql2/promise";
import { IdentifiableCart } from "common/types";
import { v4 as uuid } from "uuid";

export let db: mysql.Connection;

export async function initDb() {
    if (!process.env.DB_HOST) {
        console.warn("No DB_HOST specified (assuming local testing/development), skipping database setup");
        return;
    }
    while (!db) {
        try {
            db = await mysql.createConnection({
                host: process.env.DB_HOST,
                user: process.env.DB_USER,
                password: process.env.DB_PASSWORD,
                database: process.env.DB_NAME,
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
        CREATE TABLE IF NOT EXISTS transactions (
            receipt VARCHAR(255) PRIMARY KEY,
            token VARCHAR(255) NOT NULL
        )
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS prepurchases (
            token VARCHAR(255) PRIMARY KEY,
            cart JSON NOT NULL
        )
    `);
}

export async function isReceiptUsed(receipt: string): Promise<boolean> {
    try {
        const [rows] = (await db.query("SELECT COUNT(*) FROM transactions WHERE receipt = ?", [receipt])) as [
            RowDataPacket[],
            any,
        ];
        return rows[0]["COUNT(*)"] != 0;
    } catch (e: any) {
        console.error("Database query failed (isReceiptUsed)");
        console.error(e);
        throw new Error("Database query failed");
    }
}

export async function addFulfilledTransaction(receipt: string, token: string) {
    try {
        await db.query("INSERT INTO transactions (receipt, token) VALUES (?, ?)", [receipt, token]);
        await db.query("DELETE FROM prepurchases WHERE token = ?", [token]);
    } catch (e: any) {
        console.error("Database query failed (addFulfilledTransaction)");
        console.error(e);
        throw new Error("Database query failed");
    }
}

export async function registerPrepurchase(cart: IdentifiableCart): Promise<string> {
    try {
        const token = uuid();
        await db.query("INSERT INTO prepurchases (token, cart) VALUES (?, ?)", [token, JSON.stringify(cart)]);
        return token;
    } catch (e: any) {
        console.error("Database query failed (registerPrepurchase)");
        console.error(e);
        throw new Error("Database query failed");
    }
}

export async function getPrepurchase(token: string): Promise<IdentifiableCart | undefined> {
    try {
        const [rows] = (await db.query("SELECT cart FROM prepurchases WHERE token = ?", [token])) as [
            RowDataPacket[],
            any,
        ];
        if (rows.length === 0) return undefined;
        return JSON.parse(rows[0].cart) as IdentifiableCart;
    } catch (e: any) {
        console.error("Database query failed (isPrepurchaseValid)");
        console.error(e);
        throw new Error("Database query failed");
    }
}
