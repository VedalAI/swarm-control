import { RowDataPacket } from "mysql2";
import { LogMessage, Order } from "common/types";
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
            console.log("Failed to connect to database. Retrying in 5 seconds...");
            await new Promise((resolve) => setTimeout(resolve, 5000));
        }
    }

    await setupDb();
}

async function setupDb() {
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

export async function canLog(token: string | null): Promise<boolean> {
    try {
        if (!token) return false;

        const [rows] = (await db.query("SELECT * FROM orders WHERE id = ?", [token])) as any;
        const order = rows[0] as Order | undefined;

        return order?.state === 0; // OrderState.Prepurchase
    } catch (e: any) {
        console.error("Database query failed (canLog)");
        console.error(e);
        return true;
    }
}

export async function getUserIdFromTransactionToken(token: string): Promise<string | null> {
    try {
        const [rows] = (await db.query("SELECT userId FROM orders WHERE id = ?", [token])) as [RowDataPacket[], any];
        return rows[0].userId;
    } catch (e: any) {
        console.error("Database query failed (getUserIdFromTransactionToken)");
        console.error(e);
        return null;
    }
}

export async function isUserBanned(userId: string): Promise<boolean> {
    try {
        const [rows] = (await db.query("SELECT banned FROM users WHERE id = ?", [userId])) as [RowDataPacket[], any];
        return rows[0]?.banned;
    } catch (e: any) {
        console.error("Database query failed (isBanned)");
        console.error(e);
        return false;
    }
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
