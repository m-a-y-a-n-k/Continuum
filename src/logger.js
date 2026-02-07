export const logger = {
    info: (msg, meta = {}) => {
        process.stdout.write(JSON.stringify({ level: 'info', timestamp: new Date().toISOString(), msg, ...meta }) + '\n');
    },
    error: (msg, meta = {}) => {
        process.stderr.write(JSON.stringify({ level: 'error', timestamp: new Date().toISOString(), msg, ...meta }) + '\n');
    },
    warn: (msg, meta = {}) => {
        process.stdout.write(JSON.stringify({ level: 'warn', timestamp: new Date().toISOString(), msg, ...meta }) + '\n');
    },
    debug: (msg, meta = {}) => {
        // Only log debug in development or if explicitly enabled
        if (process.env.NODE_ENV !== 'production' || process.env.DEBUG) {
            process.stdout.write(JSON.stringify({ level: 'debug', timestamp: new Date().toISOString(), msg, ...meta }) + '\n');
        }
    },
    // Production request logger
    http: (req, res, duration, meta = {}) => {
        process.stdout.write(JSON.stringify({
            level: 'http',
            timestamp: new Date().toISOString(),
            method: req.method,
            url: req.url,
            status: res.statusCode,
            duration: `${duration}ms`,
            ip: req.socket.remoteAddress,
            ...meta
        }) + '\n');
    }
};
