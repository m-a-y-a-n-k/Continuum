import WebSocket from 'ws';
import { logger } from './logger.js';
import { domainManager } from './domainManager.js';
import { checkWAF } from './waf.js';

/**
 * WebSocket Proxy Handler
 * Proxies WebSocket connections to origin servers
 */

const activeConnections = new Map(); // connectionId -> { client, origin, metadata }

export class WebSocketProxy {
    constructor() {
        this.wss = null;
    }

    /**
     * Initialize WebSocket server
     */
    initialize(server) {
        this.wss = new WebSocket.Server({
            server,
            path: '/ws',
            verifyClient: this.verifyClient.bind(this)
        });

        this.wss.on('connection', this.handleConnection.bind(this));

        logger.info('🔌 WebSocket proxy initialized');
    }

    /**
     * Verify client before accepting connection
     */
    verifyClient(info, callback) {
        const req = info.req;
        const hostname = req.headers.host?.split(':')[0];

        // WAF check
        const wafResult = checkWAF(req, {});
        if (wafResult.blocked) {
            logger.warn('WebSocket blocked by WAF', {
                hostname,
                reason: wafResult.reason
            });
            return callback(false, 403, 'Forbidden');
        }

        // Check if domain is configured
        const origin = domainManager.getOrigin(hostname);
        if (!origin) {
            logger.warn('WebSocket connection to unknown domain', { hostname });
            return callback(false, 404, 'Domain not found');
        }

        callback(true);
    }

    /**
     * Handle new WebSocket connection
     */
    async handleConnection(clientWs, req) {
        const hostname = req.headers.host?.split(':')[0];
        const connectionId = generateConnectionId();

        logger.info('WebSocket connection established', {
            connectionId,
            hostname
        });

        try {
            // Get origin server
            const originUrl = await domainManager.getOrigin(hostname);
            if (!originUrl) {
                clientWs.close(1008, 'Domain not configured');
                return;
            }

            // Convert HTTP(S) origin to WS(S)
            const wsOrigin = originUrl.replace(/^http/, 'ws') + req.url;

            // Connect to origin WebSocket
            const originWs = new WebSocket(wsOrigin, {
                headers: {
                    ...req.headers,
                    host: new URL(originUrl).hostname
                }
            });

            // Store connection
            activeConnections.set(connectionId, {
                client: clientWs,
                origin: originWs,
                hostname,
                connectedAt: Date.now()
            });

            // Set up bidirectional forwarding
            this.setupForwarding(clientWs, originWs, connectionId);

        } catch (err) {
            logger.error('WebSocket proxy error', {
                error: err.message,
                hostname
            });
            clientWs.close(1011, 'Internal error');
        }
    }

    /**
     * Set up bidirectional message forwarding
     */
    setupForwarding(clientWs, originWs, connectionId) {
        // Client -> Origin
        clientWs.on('message', (data, isBinary) => {
            if (originWs.readyState === WebSocket.OPEN) {
                originWs.send(data, { binary: isBinary });
            }
        });

        // Origin -> Client
        originWs.on('message', (data, isBinary) => {
            if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(data, { binary: isBinary });
            }
        });

        // Handle errors
        clientWs.on('error', (err) => {
            logger.error('Client WebSocket error', {
                connectionId,
                error: err.message
            });
        });

        originWs.on('error', (err) => {
            logger.error('Origin WebSocket error', {
                connectionId,
                error: err.message
            });
        });

        // Handle close
        clientWs.on('close', (code, reason) => {
            logger.debug('Client WebSocket closed', {
                connectionId,
                code,
                reason: reason.toString()
            });
            originWs.close();
            activeConnections.delete(connectionId);
        });

        originWs.on('close', (code, reason) => {
            logger.debug('Origin WebSocket closed', {
                connectionId,
                code,
                reason: reason.toString()
            });
            clientWs.close();
            activeConnections.delete(connectionId);
        });

        // Handle origin connection open
        originWs.on('open', () => {
            logger.debug('Origin WebSocket connected', { connectionId });
        });
    }

    /**
     * Get active connections count
     */
    getActiveConnectionsCount() {
        return activeConnections.size;
    }

    /**
     * Close all connections gracefully
     */
    closeAll() {
        logger.info('Closing all WebSocket connections', {
            count: activeConnections.size
        });

        for (const [id, conn] of activeConnections.entries()) {
            conn.client.close(1001, 'Server shutting down');
            conn.origin.close(1001, 'Server shutting down');
        }

        activeConnections.clear();
    }
}

function generateConnectionId() {
    return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export const wsProxy = new WebSocketProxy();
