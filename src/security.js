/**
 * Security Headers Middleware
 * Adds essential security headers to all responses
 */

export function addSecurityHeaders(res) {
    const headers = {
        // Prevent clickjacking
        'X-Frame-Options': 'SAMEORIGIN',

        // Enable XSS protection
        'X-XSS-Protection': '1; mode=block',

        // Prevent MIME type sniffing
        'X-Content-Type-Options': 'nosniff',

        // Referrer policy
        'Referrer-Policy': 'strict-origin-when-cross-origin',

        // Content Security Policy
        'Content-Security-Policy': [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' https://accounts.google.com",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: https:",
            "font-src 'self' data:",
            "connect-src 'self'",
            "frame-ancestors 'self'"
        ].join('; '),

        // Permissions Policy (formerly Feature Policy)
        'Permissions-Policy': [
            'geolocation=()',
            'microphone=()',
            'camera=()'
        ].join(', '),

        // HSTS (HTTP Strict Transport Security)
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',

        // Powered by header removal (security through obscurity)
        'X-Powered-By': 'Continuum CDN'
    };

    for (const [key, value] of Object.entries(headers)) {
        res.setHeader(key, value);
    }
}

/**
 * CORS Configuration
 */
export function handleCORS(req, res, domainConfig = {}) {
    const corsConfig = domainConfig.cors || {};

    const origin = req.headers.origin;
    const allowedOrigins = corsConfig.allowedOrigins || ['*'];

    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
    }

    res.setHeader('Access-Control-Allow-Methods',
        corsConfig.allowedMethods || 'GET, POST, PUT, DELETE, OPTIONS');

    res.setHeader('Access-Control-Allow-Headers',
        corsConfig.allowedHeaders || 'Content-Type, Authorization, X-Requested-With');

    res.setHeader('Access-Control-Max-Age',
        corsConfig.maxAge || '86400');

    if (corsConfig.allowCredentials) {
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    // Handle preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return true; // Indicates request was handled
    }

    return false;
}

/**
 * IP Whitelist Check for Admin Routes
 */
export function checkIPWhitelist(req) {
    const whitelist = process.env.ADMIN_WHITELIST_IPS;
    if (!whitelist) return true; // No whitelist configured

    const clientIP = req.socket.remoteAddress;
    const allowedIPs = whitelist.split(',').map(ip => ip.trim());

    // Check exact match or CIDR range
    for (const allowed of allowedIPs) {
        if (allowed.includes('/')) {
            // CIDR notation
            if (isIPInCIDR(clientIP, allowed)) return true;
        } else {
            // Exact match
            if (clientIP === allowed) return true;
        }
    }

    return false;
}

/**
 * Check if IP is in CIDR range
 */
function isIPInCIDR(ip, cidr) {
    const [range, bits] = cidr.split('/');
    const mask = ~(2 ** (32 - parseInt(bits)) - 1);

    const ipNum = ipToNumber(ip);
    const rangeNum = ipToNumber(range);

    return (ipNum & mask) === (rangeNum & mask);
}

function ipToNumber(ip) {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
}

/**
 * Request Signing for Admin API
 */
export function verifyRequestSignature(req) {
    const signature = req.headers['x-continuum-signature'];
    const timestamp = req.headers['x-continuum-timestamp'];

    if (!signature || !timestamp) return false;

    // Check timestamp (prevent replay attacks)
    const now = Date.now();
    const requestTime = parseInt(timestamp);
    if (Math.abs(now - requestTime) > 300000) { // 5 minutes
        return false;
    }

    // Verify signature
    const secret = process.env.SESSION_SECRET || 'default-secret';
    const crypto = require('crypto');
    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(`${req.method}${req.url}${timestamp}`)
        .digest('hex');

    return signature === expectedSignature;
}

/**
 * Generate request signature (for clients)
 */
export function generateRequestSignature(method, url) {
    const timestamp = Date.now().toString();
    const secret = process.env.SESSION_SECRET || 'default-secret';
    const crypto = require('crypto');

    const signature = crypto
        .createHmac('sha256', secret)
        .update(`${method}${url}${timestamp}`)
        .digest('hex');

    return {
        'X-Continuum-Signature': signature,
        'X-Continuum-Timestamp': timestamp
    };
}
