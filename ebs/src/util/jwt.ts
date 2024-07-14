import jwt from "jsonwebtoken";

const memo: { [key: string]: string | jwt.JwtPayload } = {};
let cachedBuffer: Buffer;

export function verifyJWT(token: string): boolean {
    try {
        parseJWT(token);
        return true;
    } catch (e) {
        console.error(e);
        return false;
    }
}

export function parseJWT(token: string) {
    if (memo[token]) return memo[token];

    const result = jwt.verify(token, getJwtSecretBuffer(), { ignoreExpiration: true });
    memo[token] = result;
    return result;
}

function getJwtSecretBuffer() {
    return cachedBuffer ??= Buffer.from(process.env.JWT_SECRET!, "base64");
}

export function signJWT(payload: object, options?: jwt.SignOptions) {
    return jwt.sign(payload, getJwtSecretBuffer(), options);
}
