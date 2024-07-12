import { RowDataPacket } from "mysql2";
import { LogMessage, Order, User } from "common/types";
import { stringify } from "./stringify";
import { logToDiscord } from "./discord";
import mysql from "mysql2/promise";

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

async function getById<T>(table: string, id: string | null): Promise<T | null> {
    try {
        if (!id) return null;
        const [rows] = (await db.query(`SELECT * FROM ${table} WHERE id = ?`, [id])) as [RowDataPacket[], any];
        return (rows[0] as T) || null;
    } catch (e: any) {
        console.error(`Database query failed (getById from ${table})`);
        console.error(e);
        return null;
    }
}

export async function getOrderById(orderId: string | null): Promise<Order | null> {
    return getById("orders", orderId);
}

export async function getUserById(userId: string | null): Promise<User | null> {
    return getById("users", userId);
}

export async function logToDatabase(logMessage: LogMessage, isFromBackend: boolean) {
    try {
        await db.query("INSERT INTO logs (userId, transactionToken, data, fromBackend) VALUES (?, ?, ?, ?)", [
            logMessage.userIdInsecure,
            logMessage.transactionToken,
            stringify(logMessage, isFromBackend),
            isFromBackend,
        ]);
    } catch (e: any) {
        console.error("Database query failed (logToDatabase)");
        console.error(e);

        if (!logMessage.important) logToDiscord(logMessage, isFromBackend);
    }
}
