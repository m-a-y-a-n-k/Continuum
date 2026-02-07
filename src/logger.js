import { config } from './config.js';

// Sentry integration (optional)
let Sentry = null;
if (config.logging.sentry.enabled) {
    try {
        // Dynamically import Sentry if configured
        // In production, install: npm install @sentry/node
        // Sentry = await import('@sentry/node');
        // Sentry.init({ dsn: config.logging.sentry.dsn });
        console.log('⚠️  Sentry DSN configured but @sentry/node not installed');
    } catch (e) {
        console.warn('Sentry initialization failed:', e.message);
    }
}

const LOG_LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
};

const currentLevel = LOG_LEVELS[config.logging.level] || LOG_LEVELS.info;
const useJSON = config.logging.format === 'json';

function formatMessage(level, message, metadata = {}) {
    const timestamp = new Date().toISOString();

    if (useJSON) {
        return JSON.stringify({
            timestamp,
            level,
            message,
            ...metadata,
            pid: process.pid
        });
    }

    // Text format
    const metaStr = Object.keys(metadata).length > 0
        ? ' ' + JSON.stringify(metadata)
        : '';
    return `[${timestamp}] [${level.toUpperCase()}] [PID:${process.pid}] ${message}${metaStr}`;
}

function shouldLog(level) {
    return LOG_LEVELS[level] >= currentLevel;
}

export const logger = {
    debug(message, metadata) {
        if (!shouldLog('debug')) return;
        console.log(formatMessage('debug', message, metadata));
    },

    info(message, metadata) {
        if (!shouldLog('info')) return;
        console.log(formatMessage('info', message, metadata));
    },

    warn(message, metadata) {
        if (!shouldLog('warn')) return;
        console.warn(formatMessage('warn', message, metadata));
    },

    error(message, metadata) {
        if (!shouldLog('error')) return;
        console.error(formatMessage('error', message, metadata));

        // Send to Sentry if configured
        if (Sentry && metadata?.error) {
            Sentry.captureException(metadata.error, {
                extra: { message, ...metadata }
            });
        }
    },

    // Production request logger
    http(req, res, duration, meta = {}) {
        if (!shouldLog('info')) return;

        const logData = {
            method: req.method,
            url: req.url,
            status: res.statusCode,
            duration: `${duration}ms`,
            ip: req.socket.remoteAddress,
            ...meta
        };

        console.log(formatMessage('http', 'HTTP Request', logData));
    }
};
