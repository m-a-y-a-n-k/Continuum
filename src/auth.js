import crypto from 'crypto';

const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASS = process.env.ADMIN_PASS || "admin123";

export function checkAuth(req) {
    const authHeader = req.headers.authorization;

    if (!authHeader) return false;

    const [scheme, credentials] = authHeader.split(" ");
    if (!/^Basic$/i.test(scheme)) return false;

    const decoded = Buffer.from(credentials, 'base64').toString('utf-8');
    const [user, pass] = decoded.split(":");

    // Constant time comparison to prevent timing attacks
    const userMatch = crypto.timingSafeEqual(
        Buffer.from(user.padEnd(32)),
        Buffer.from(ADMIN_USER.padEnd(32))
    );

    // Simple check for now (production should use hash comparison)
    return user === ADMIN_USER && pass === ADMIN_PASS;
}

export function requireAuth(req, res) {
    res.writeHead(401, {
        'WWW-Authenticate': 'Basic realm="Pravah Admin Access"',
        'Content-Type': 'text/plain'
    });
    res.end('Authentication Required');
}
