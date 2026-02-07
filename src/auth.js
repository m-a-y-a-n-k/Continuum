import crypto from 'crypto';
import nodemailer from 'nodemailer';
import cookie from 'cookie';
import Redis from "ioredis";
import { config } from "./config.js";
import { OAuth2Client } from 'google-auth-library';

// Google OAuth Client Initialization
const googleClient = new OAuth2Client(
    config.google.clientId,
    config.google.clientSecret,
    config.google.redirectUri
);

// Redis for Session/OTP (Cluster Support)
let redis = null;
if (config.redis.enabled) {
    redis = new Redis({
        host: config.redis.host,
        port: config.redis.port,
        lazyConnect: true
    });
    redis.on("error", () => { }); // Prevent crash if Redis is down
}

// Fallback In-Memory Storage (Only works if single worker)
const otpStore = new Map(); // email -> { otp, expires }
const sessionStore = new Map(); // sessionId -> { email, expires }

const SESSION_TTL = 24 * 60 * 60; // Seconds
const OTP_TTL = 5 * 60; // Seconds

// Email Transporter (Mock or Real)
let transporter = null;
if (config.smtp.host) {
    transporter = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.port === 465,
        auth: {
            user: config.smtp.user,
            pass: config.smtp.pass
        }
    });
    logger.info("SMTP configured", { host: config.smtp.host, port: config.smtp.port });
}

// 1. Check if Request is Authenticated
export async function checkAuth(req) {
    const cookies = cookie.parse(req.headers.cookie || '');
    const sessionId = cookies['Continuum_session'];

    if (!sessionId) return false;

    if (redis && redis.status === 'ready') {
        const session = await redis.get(`session:${sessionId}`);
        return !!session;
    } else {
        if (!sessionStore.has(sessionId)) return false;
        const session = sessionStore.get(sessionId);
        if (Date.now() > session.expires) {
            sessionStore.delete(sessionId);
            return false;
        }
        return true;
    }
}

// 2. Redirect to Login Page
export function requireAuth(req, res) {
    res.writeHead(302, { 'Location': '/login' });
    res.end();
}

// 3. Send OTP
export async function sendLoginOTP(req, res) {
    let body = "";
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
        try {
            const { email } = JSON.parse(body);
            if (!email) throw new Error("Email required");

            // Generate 6-digit OTP
            const otp = crypto.randomInt(100000, 999999).toString();

            if (redis && redis.status === 'ready') {
                await redis.set(`otp:${email}`, otp, "EX", OTP_TTL);
            } else {
                otpStore.set(email, { otp, expires: Date.now() + (OTP_TTL * 1000) });
            }

            const message = `Your Continuum Admin Login Code is: ${otp}`;

            // Send Email
            if (transporter) {
                await transporter.sendMail({
                    from: `"Continuum Admin" <${config.smtp.from}>`,
                    to: email,
                    subject: 'Admin Login Code',
                    text: message
                });
                console.log(`📧 Email sent to ${email}`);
            } else {
                // Fallback: Log to console for dev
                console.log(`\n🔑 [DEV MODE] OTP for ${email}: ${otp}\n`);
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, msg: "OTP Sent" }));
        } catch (e) {
            res.writeHead(400);
            res.end(JSON.stringify({ success: false, error: e.message }));
        }
    });
}

// 4. Verify OTP & Set Cookie
export function verifyLoginOTP(req, res) {
    let body = "";
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
        try {
            const { email, otp } = JSON.parse(body);
            let isValid = false;

            if (redis && redis.status === 'ready') {
                const storedOtp = await redis.get(`otp:${email}`);
                if (storedOtp && storedOtp === otp) {
                    isValid = true;
                    await redis.del(`otp:${email}`);
                }
            } else {
                const stored = otpStore.get(email);
                if (stored && Date.now() < stored.expires && stored.otp === otp) {
                    isValid = true;
                    otpStore.delete(email);
                }
            }

            if (!isValid) throw new Error("Invalid or expired OTP");

            // Success: Create Session
            const sessionId = crypto.randomUUID();

            if (redis && redis.status === 'ready') {
                await redis.set(`session:${sessionId}`, email, "EX", SESSION_TTL);
            } else {
                sessionStore.set(sessionId, { email, expires: Date.now() + (SESSION_TTL * 1000) });
            }

            // Set HttpOnly Cookie
            const setCookie = cookie.serialize('Continuum_session', sessionId, {
                httpOnly: true,
                maxAge: SESSION_TTL,
                path: '/',
                sameSite: 'strict',
            });

            res.writeHead(200, {
                'Set-Cookie': setCookie,
                'Content-Type': 'application/json'
            });
            res.end(JSON.stringify({ success: true }));

        } catch (e) {
            res.writeHead(401);
            res.end(JSON.stringify({ success: false, error: e.message }));
        }
    });
}

// 5. Google OAuth Flow
export function startGoogleLogin(req, res) {
    if (!config.google.clientId) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        return res.end(`<h1>Google Login Not Configured</h1><p>Please add GOOGLE_CLIENT_ID to .env</p><a href="/login">Back</a>`);
    }

    const authorizeUrl = googleClient.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/userinfo.profile', 'https://www.googleapis.com/auth/userinfo.email'],
    });

    res.writeHead(302, { Location: authorizeUrl });
    res.end();
}

export async function handleGoogleCallback(req, res) {
    try {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const code = url.searchParams.get('code');

        const { tokens } = await googleClient.getToken(code);
        googleClient.setCredentials(tokens);

        const ticket = await googleClient.verifyIdToken({
            idToken: tokens.id_token,
            audience: config.google.clientId,
        });

        const payload = ticket.getPayload();
        const email = payload.email;

        // Create Session
        const sessionId = crypto.randomUUID();
        if (redis && redis.status === 'ready') {
            await redis.set(`session:${sessionId}`, email, "EX", SESSION_TTL);
        } else {
            sessionStore.set(sessionId, { email, expires: Date.now() + (SESSION_TTL * 1000) });
        }

        const setCookie = cookie.serialize('Continuum_session', sessionId, {
            httpOnly: true,
            maxAge: SESSION_TTL,
            path: '/',
            sameSite: 'strict',
        });

        res.writeHead(302, {
            'Set-Cookie': setCookie,
            'Location': '/admin-dashboard'
        });
        res.end();
    } catch (e) {
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end(`<h1>Auth Failed</h1><p>${e.message}</p><a href="/login">Retry</a>`);
    }
}
