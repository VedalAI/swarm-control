import { NextFunction, Request, Response } from "express";
import { parseJWT, verifyJWT } from "./jwt";
import { AuthorizationPayload } from "../types";
import { sendToLogger } from "./logger";
import { User } from "common/types";
import { getOrAddUser } from "./db";

export async function publicApiAuth(req: Request, res: Response, next: NextFunction) {
    const auth = req.header("Authorization");

    if (!auth || !auth.startsWith("Bearer ")) {
        res.status(401).send("Missing or malformed session token");
        return;
    }

    const token = auth.substring(7);
    if (!verifyJWT(token)) {
        res.status(401).send("Invalid session token");
        return;
    }

    const twitchAuthorization = parseJWT(token) as AuthorizationPayload;

    if (!twitchAuthorization.user_id) {
        sendToLogger({
            transactionToken: null,
            userIdInsecure: null,
            important: false,
            fields: [
                {
                    header: "Missing user ID in JWT",
                    content: twitchAuthorization,
                },
            ],
        }).then();
        res.status(500).send("Missing required data in JWT");
        return;
    }

    req.user = await getOrAddUser(twitchAuthorization.user_id);
    req.auth = twitchAuthorization;

    if (req.user.banned) {
        res.status(403).send("You are banned from using this extension");
        return;
    }

    next();
}

export function privateApiAuth(req: Request, res: Response, next: NextFunction) {
    const auth = req.header("Authorization");
    if (auth != "Bearer " + process.env.PRIVATE_API_KEY) {
        res.status(401).send("Invalid private API key... Why are you here? Please leave.");
        return;
    }

    next();
}

declare global {
    namespace Express {
        export interface Request {
            user: User;
            auth: AuthorizationPayload;
        }
    }
}

export function asyncCatch(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            await fn(req, res, next);
        } catch (err: any) {
            console.log(err);

            sendToLogger({
                transactionToken: null,
                userIdInsecure: null,
                important: true,
                fields: [
                    {
                        header: "Error in asyncCatch",
                        content: err?.stack ?? err,
                    },
                ],
            }).then();

            next(err);
        }
    };
}
