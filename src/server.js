import http from "http";
import cluster from "cluster";
import os from "os";
import { handleRequest, cleanupExpiredCache, purgeCache } from "./proxy.js";
import { getStats, saveStats, logRequest } from "./analytics.js";
import { config } from "./config.js";
import { domainManager } from "./domainManager.js";
import { renderAdminDashboard } from "./adminUi.js";
import { renderLandingPage } from "./landing.js";
import { renderLoginPage } from "./authUi.js";
import { renderDashboard } from "./dashboardUi.js";
import { logger } from "./logger.js";
import { checkAuth, requireAuth, sendLoginOTP, verifyLoginOTP, startGoogleLogin, handleGoogleCallback } from "./auth.js";
import { startHealthMonitor } from "./healthMonitor.js";
import { dnsManager } from "./dnsManager.js";
import { sslManager } from "./sslManager.js";
import { secureServerManager } from "./secureServer.js";
import { addSecurityHeaders, handleCORS, checkIPWhitelist } from "./security.js";
import { wsProxy } from "./websocketProxy.js";
import { register as metricsRegister, httpRequestDuration, httpRequestTotal, activeConnections } from "./metrics.js";

const PORT = config.port;
const HTTPS_PORT = config.https.port;
let isShuttingDown = false;

if (config.cluster && cluster.isPrimary) {
    const numWorkers = config.maxWorkers || os.cpus().length;
    logger.info(`🛡️ Continuum Primary ${process.pid} is running`);
    logger.info(`📊 Dashboard: http://localhost:${PORT}/cdn-dashboard`);
    logger.info(`🔧 Admin: http://localhost:${PORT}/admin-dashboard`);

    if (config.https.enabled) {
        logger.info(`🔒 HTTPS Port: ${HTTPS_PORT}`);
    }
    if (config.prometheus.enabled) {
        logger.info(`📈 Metrics: http://localhost:${config.prometheus.port}${config.prometheus.path}`);
    }

    for (let i = 0; i < numWorkers; i++) {
        cluster.fork();
    }

    startHealthMonitor();

    // Periodic GC on Primary
    setInterval(() => cleanupExpiredCache(), 10 * 60 * 1000);

    // Start Prometheus metrics server if enabled
    if (config.prometheus.enabled) {
        const metricsServer = http.createServer((req, res) => {
            if (req.url === config.prometheus.path) {
                res.setHeader('Content-Type', metricsRegister.contentType);
                metricsRegister.metrics().then(data => {
                    res.end(data);
                }).catch(err => {
                    logger.error("Metrics Server Error", { error: err.message });
                    res.writeHead(500);
                    res.end("Internal Error");
                });
            } else {
                res.writeHead(404);
                res.end('Not Found');
            }
        });
        metricsServer.listen(config.prometheus.port, () => {
            logger.info(`📊 Prometheus metrics server on port ${config.prometheus.port}`);
        });
    }

    cluster.on("exit", (worker, code, signal) => {
        if (!isShuttingDown) {
            logger.warn(`⚠️ Worker ${worker.process.pid} died (code: ${code}, signal: ${signal}). Forking a new one...`);
            cluster.fork();
        }
    });

    async function shutdown(signal) {
        isShuttingDown = true;
        logger.info(`\nRECEIVED ${signal}. Graceful shutdown...`);
        saveStats();
        for (const id in cluster.workers) {
            cluster.workers[id].send('shutdown');
            cluster.workers[id].disconnect();
        }
        setTimeout(() => process.exit(0), 2000);
    }

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));

} else {
    // Worker process
    const requestHandler = async (req, res) => {
        try {
            const startTime = Date.now();
            // Track active connections
            activeConnections.inc();

            const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

            // Add security headers
            addSecurityHeaders(res);

            // Handle CORS
            if (handleCORS(req, res)) {
                return; // Preflight handled
            }

            // Prometheus metrics endpoint
            if (config.prometheus.enabled && url.pathname === config.prometheus.path) {
                res.setHeader('Content-Type', metricsRegister.contentType);
                const metrics = await metricsRegister.metrics();
                res.writeHead(200);
                return res.end(metrics);
            }

            // Authentication routes
            if (url.pathname === "/login") {
                res.writeHead(200, { "Content-Type": "text/html" });
                return res.end(renderLoginPage());
            }
            if (url.pathname === "/auth/login" && req.method === "POST") {
                return sendLoginOTP(req, res);
            }
            if (url.pathname === "/auth/verify" && req.method === "POST") {
                return verifyLoginOTP(req, res);
            }
            if (url.pathname === "/auth/google") {
                return startGoogleLogin(req, res);
            }
            if (url.pathname === "/auth/google/callback") {
                return handleGoogleCallback(req, res);
            }

            // Admin routes - require authentication and IP whitelist
            if ((url.pathname.startsWith("/admin/") || url.pathname === "/admin-dashboard")) {
                // Check IP whitelist
                if (config.security.adminWhitelist.length > 0 && !checkIPWhitelist(req)) {
                    logger.warn("Admin access denied - IP not whitelisted", {
                        ip: req.socket.remoteAddress
                    });
                    res.writeHead(403);
                    activeConnections.dec();
                    return res.end("Forbidden: IP not whitelisted");
                }

                // Check authentication
                if (!(await checkAuth(req))) {
                    activeConnections.dec();
                    return requireAuth(req, res);
                }
            }

            // Admin API endpoints
            if (url.pathname === "/admin/domains" && req.method === "GET") {
                res.writeHead(200, { "Content-Type": "application/json" });
                return res.end(JSON.stringify(domainManager.getAll()));
            }

            if (url.pathname === "/admin/domains" && req.method === "POST") {
                let body = [];
                req.on("data", chunk => body.push(chunk));
                req.on("end", async () => {
                    try {
                        const data = JSON.parse(Buffer.concat(body).toString());
                        await domainManager.addDomain(data.hostname, data.origin, { plan: data.plan });
                        res.writeHead(200, { "Content-Type": "application/json" });
                        res.end(JSON.stringify({ success: true }));
                    } catch (e) {
                        res.writeHead(400);
                        res.end("Error");
                    }
                    activeConnections.dec();
                });
                return;
            }

            if (url.pathname === "/admin/domains" && req.method === "DELETE") {
                let body = [];
                req.on("data", chunk => body.push(chunk));
                req.on("end", async () => {
                    try {
                        const data = JSON.parse(Buffer.concat(body).toString());
                        const success = await domainManager.removeDomain(data.hostname);
                        res.writeHead(200, { "Content-Type": "application/json" });
                        res.end(JSON.stringify({ success }));
                    } catch (e) {
                        res.writeHead(400);
                        res.end("Error");
                    }
                    activeConnections.dec();
                });
                return;
            }

            // DNS & SSL API
            if (url.pathname === "/admin/dns-verify" && req.method === "POST") {
                let body = [];
                req.on("data", chunk => body.push(chunk));
                req.on("end", async () => {
                    try {
                        const { hostname } = JSON.parse(Buffer.concat(body).toString());
                        const cdnHost = req.headers.host.split(':')[0];
                        const result = await dnsManager.verifyCNAME(hostname, cdnHost);
                        res.writeHead(200, { "Content-Type": "application/json" });
                        res.end(JSON.stringify(result));
                    } catch (e) {
                        res.writeHead(400);
                        res.end("Error parsing request");
                    }
                    activeConnections.dec();
                });
                return;
            }

            if (url.pathname === "/admin/ssl-provision" && req.method === "POST") {
                let body = [];
                req.on("data", chunk => body.push(chunk));
                req.on("end", async () => {
                    const { hostname } = JSON.parse(Buffer.concat(body).toString());
                    try {
                        const result = await sslManager.getCertificate(hostname);
                        res.writeHead(200, { "Content-Type": "application/json" });
                        res.end(JSON.stringify({ success: true, msg: "SSL Certificate Ready" }));
                    } catch (e) {
                        res.writeHead(500, { "Content-Type": "application/json" });
                        res.end(JSON.stringify({ success: false, msg: e.message }));
                    }
                    activeConnections.dec();
                });
                return;
            }

            // Public pages
            if (url.pathname === "/" || url.pathname === "/landing") {
                res.writeHead(200, { "Content-Type": "text/html" });
                return res.end(renderLandingPage());
            }

            if (url.pathname === "/admin-dashboard") {
                res.writeHead(200, { "Content-Type": "text/html" });
                return res.end(renderAdminDashboard());
            }

            if (url.pathname === "/cdn-dashboard") {
                res.writeHead(200, { "Content-Type": "text/html" });
                return res.end(renderDashboard(getStats()));
            }

            if (url.pathname === "/cdn-purge") {
                const result = purgeCache(url.searchParams.get("path") || "all", url.searchParams.get("domain"));
                res.writeHead(200, { "Content-Type": "application/json" });
                return res.end(JSON.stringify(result));
            }

            if (url.pathname === "/health") {
                res.writeHead(200);
                return res.end("OK");
            }

            // Proxy request
            await handleRequest(req, res);

            // Record metrics
            const duration = Date.now() - startTime;
            const cacheStatus = res.getHeader('X-Cache') || 'UNKNOWN';
            if (config.prometheus.enabled) {
                httpRequestDuration.observe(
                    { method: req.method, route: url.pathname, status_code: res.statusCode, cache_status: cacheStatus },
                    duration / 1000
                );
                httpRequestTotal.inc({ method: req.method, route: url.pathname, status_code: res.statusCode, cache_status: cacheStatus });
            }

        } catch (err) {
            logger.error("Request Error", { error: err.message, stack: err.stack });
            const hostname = req.headers.host?.split(':')[0] || 'unknown';
            logRequest("ERROR", hostname, req.url, req.socket.remoteAddress);
            res.writeHead(500);
            res.end("Internal Error");
        } finally {
            activeConnections.dec();
        }
    };

    // Create server (HTTP or HTTPS/HTTP2 based on config)
    const server = config.https.enabled
        ? secureServerManager.createServer(requestHandler)
        : http.createServer(requestHandler);

    // Initialize WebSocket proxy if enabled
    if (config.websocket.enabled) {
        wsProxy.initialize(server);
    }

    const listenPort = config.https.enabled ? HTTPS_PORT : PORT;
    server.on('error', (err) => {
        logger.error(`❌ Worker ${process.pid} Server Error`, { error: err.message, port: listenPort });
        process.exit(1);
    });

    server.listen(listenPort, () => {
        logger.info(`🚀 Worker ${process.pid} listening on port ${listenPort}`);
    });

    // HTTP to HTTPS redirect server
    if (config.https.enabled && config.https.redirectHTTP) {
        const redirectServer = http.createServer((req, res) => {
            const host = req.headers.host?.split(':')[0];
            const redirectUrl = `https://${host}${req.url}`;
            res.writeHead(301, { Location: redirectUrl });
            res.end();
        });
        redirectServer.on('error', (err) => {
            logger.error(`❌ Worker ${process.pid} Redirect Server Error`, { error: err.message, port: PORT });
        });
        redirectServer.listen(PORT, () => {
            logger.info(`🔀 HTTP redirect server on port ${PORT} -> HTTPS ${HTTPS_PORT}`);
        });
    }

    process.on('message', (msg) => {
        if (msg === 'shutdown') {
            saveStats();
            if (config.websocket.enabled) {
                wsProxy.closeAll();
            }
            server.close(() => process.exit(0));
        }
    });
}
