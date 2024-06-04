import {Request, Response, NextFunction} from "express";
import {parseJWT, verifyJWT} from "./jwt";
import {AuthorizationPayload} from "./types";

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
    const auth = req.header("Authorization");
    if (!auth || !auth.startsWith("Bearer ")) {
        res.status(401).send("Missing or malformed session token");
        return;
    }

    const token = auth.substring(7);
    if (!verifyJWT(token)) {
        res.status(401).send("Invalid session token")
        return;
    }

    req.twitchAuthorization = parseJWT(token) as AuthorizationPayload;

    next();
}

declare global {
    namespace Express {
        export interface Request {
            twitchAuthorization?: AuthorizationPayload;
        }
    }
}
