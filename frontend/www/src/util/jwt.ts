// jsonwebtoken is node-only so we'll do this one manually
export function getJWTPayload(token: string) {
    const firstDot = token.indexOf('.');
    if (firstDot < 0) return null;
    
    const secondDot = token.indexOf('.', firstDot + 1);
    if (secondDot < 0) return null;
    
    const payload = token.substring(firstDot + 1, secondDot);
    try {
        return JSON.parse(atob(payload));
    } catch (e) {
        console.error("failed to parse JWT", e);
        return null;
    }
}
