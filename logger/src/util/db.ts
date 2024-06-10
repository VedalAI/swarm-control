import { db } from "../index";
import { RowDataPacket } from "mysql2";

export async function canLog(token: string | null): Promise<boolean> {
    try {
        if (!token) return false;

        const [rows] = (await db.query("SELECT COUNT(*) FROM prepurchases WHERE token = ?", [token])) as any;
        if (rows[0]["COUNT(*)"] != 0) return true;

        const [rows2] = (await db.query("SELECT COUNT(*) FROM transactions WHERE token = ?", [token])) as any;
        if (rows2[0]["COUNT(*)"] != 0) return true;

        return false;
    } catch (e: any) {
        console.error("Database query failed (canLog)");
        console.error(e);
        return true;
    }
}

export async function getUserIdFromTransactionToken(token: string): Promise<string | null> {
    try {
        const [rows] = (await db.query("SELECT userId FROM transactions WHERE token = ?", [token])) as [RowDataPacket[], any];
        return rows[0].userId;
    } catch (e: any) {
        console.error("Database query failed (getUserIdFromTransactionToken)");
        console.error(e);
        return null;
    }
}

export async function isUserBanned(userId: string): Promise<boolean> {
    try {
        const [rows] = (await db.query("SELECT COUNT(*) FROM bans WHERE userId = ?", [userId])) as [RowDataPacket[], any];
        return rows[0]["COUNT(*)"] != 0;
    } catch (e: any) {
        console.error("Database query failed (isBanned)");
        console.error(e);
        return false;
    }
}
