import { db } from "../index";

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
