import https from "https";
import http2 from "http2";
import http from "http";
import tls from "tls";
import fs from "fs";
import path from "path";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { sslManager } from "./sslManager.js";

/**
 * HTTPS/HTTP2 Server Manager
 * Handles secure connections with automatic SSL certificate loading
 */

const activeCertificates = new Map(); // hostname -> { cert, key, loadedAt }

export class SecureServerManager {
    constructor() {
        this.http2Enabled = config.http2?.enabled || false;
        this.sniCallback = this.sniCallback.bind(this);
    }

    /**
     * SNI (Server Name Indication) Callback
     * Dynamically loads SSL certificates based on hostname
     */
    async sniCallback(hostname, callback) {
        try {
            logger.debug("SNI Request", { hostname });

            // Check if certificate is already loaded and valid
            if (activeCertificates.has(hostname)) {
                const cached = activeCertificates.get(hostname);
                const age = Date.now() - cached.loadedAt;

                // Reload if older than 1 hour (in case of renewal)
                if (age < 3600000) {
                    return callback(null, cached.context);
                }
            }

            // Load certificate
            const { cert, key } = await sslManager.getCertificate(hostname);

            const context = tls.createSecureContext({
                cert,
                key
            });

            activeCertificates.set(hostname, {
                context,
                loadedAt: Date.now()
            });

            callback(null, context);
        } catch (err) {
            logger.error("SNI Callback Error", { hostname, error: err.message });
            callback(err);
        }
    }

    /**
     * Create HTTPS Server
     */
    createHTTPSServer(requestHandler) {
        const options = {
            SNICallback: this.sniCallback
        };

        return https.createServer(options, requestHandler);
    }

    /**
     * Create HTTP/2 Server
     */
    createHTTP2Server(requestHandler) {
        const options = {
            SNICallback: this.sniCallback,
            allowHTTP1: true // Fallback to HTTP/1.1 if client doesn't support HTTP/2
        };

        const server = http2.createSecureServer(options);

        server.on('stream', (stream, headers) => {
            // Convert HTTP/2 stream to HTTP/1.1-like request/response
            const req = {
                method: headers[':method'],
                url: headers[':path'],
                headers: headers,
                httpVersion: '2.0',
                socket: stream.session.socket,
                on: stream.on.bind(stream),
                pipe: stream.pipe.bind(stream)
            };

            const res = {
                writeHead: (status, responseHeaders) => {
                    stream.respond({
                        ':status': status,
                        ...responseHeaders
                    });
                },
                write: stream.write.bind(stream),
                end: stream.end.bind(stream),
                setHeader: (name, value) => {
                    if (!res._headers) res._headers = {};
                    res._headers[name] = value;
                },
                getHeaders: () => res._headers || {},
                statusCode: 200
            };

            requestHandler(req, res);
        });

        return server;
    }

    /**
     * Create appropriate server based on configuration
     */
    createServer(requestHandler) {
        if (config.https?.enabled) {
            if (this.http2Enabled) {
                logger.info("🚀 Creating HTTP/2 Server with TLS");
                return this.createHTTP2Server(requestHandler);
            } else {
                logger.info("🔒 Creating HTTPS Server");
                return this.createHTTPSServer(requestHandler);
            }
        }

        logger.info("⚠️  Creating HTTP Server (not recommended for production)");
        return http.createServer(requestHandler);
    }
}

export const secureServerManager = new SecureServerManager();
