export const config = {
    // Server Configuration
    port: process.env.PORT || 5000,

    // HTTPS/HTTP2 Configuration
    https: {
        enabled: process.env.HTTPS_ENABLED === 'true' || false,
        port: process.env.HTTPS_PORT || 443,
        redirectHTTP: process.env.HTTPS_REDIRECT === 'true' || true
    },
    http2: {
        enabled: process.env.ENABLE_HTTP2 === 'true' || false,
        pushEnabled: true,
        maxConcurrentStreams: 100
    },

    // Domain Configuration
    domains: {
        // No default proxying to allow system landing pages
    },

    // Cache Configuration
    cacheDir: "./cache-data",
    defaultTTL: parseInt(process.env.DEFAULT_TTL) || 3600,
    cacheMaxSizeMB: parseInt(process.env.CACHE_MAX_SIZE_MB) || 10240,
    compression: true,

    // Cluster Configuration
    cluster: process.env.CLUSTER_ENABLED !== 'false',
    maxWorkers: parseInt(process.env.MAX_WORKERS) || 4,

    // Rate Limiting
    rateLimit: {
        windowMs: 15 * 60 * 1000,
        max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
        redisPrefix: process.env.RATE_LIMIT_REDIS_PREFIX || 'continuum:ratelimit:'
    },

    // Redis Configuration
    redis: {
        enabled: process.env.REDIS_ENABLED !== 'false',
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
        db: parseInt(process.env.REDIS_DB) || 0
    },

    // Analytics & Monitoring
    analyticsEnabled: process.env.ANALYTICS_ENABLED !== 'false',
    prometheus: {
        enabled: process.env.PROMETHEUS_ENABLED === 'true' || false,
        port: parseInt(process.env.PROMETHEUS_PORT) || 9090,
        path: '/metrics'
    },

    // Health Check
    healthCheck: {
        enabled: process.env.HEALTH_CHECK_ENABLED !== 'false',
        interval: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 30000,
        timeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT) || 5000
    },

    // Image Optimization
    optimization: {
        autoWebp: process.env.AUTO_WEBP !== 'false',
        autoAvif: process.env.AUTO_AVIF !== 'false',
        minify: process.env.MINIFY_ENABLED !== 'false',
        maxImageSize: parseInt(process.env.MAX_IMAGE_SIZE_MB) || 50
    },

    // Google OAuth
    google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        redirectUri: process.env.GOOGLE_REDIRECT_URI || `http://localhost:${process.env.PORT || 5000}/auth/google/callback`
    },

    // SMTP Configuration
    smtp: {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
        from: process.env.SMTP_FROM || 'noreply@continuum-cdn.com'
    },

    // ACME/SSL Configuration
    acme: {
        directory: process.env.ACME_DIRECTORY === 'production' ? 'production' : 'staging',
        email: process.env.ACME_EMAIL || 'admin@continuum-cdn.com',
        renewDays: parseInt(process.env.ACME_RENEW_DAYS) || 30
    },

    // Security
    security: {
        adminWhitelist: process.env.ADMIN_WHITELIST_IPS?.split(',').map(ip => ip.trim()) || [],
        sessionSecret: process.env.SESSION_SECRET || 'change-this-in-production',
        requireSignedRequests: process.env.REQUIRE_SIGNED_REQUESTS === 'true' || false
    },

    // Logging
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        format: process.env.LOG_FORMAT || 'text', // 'text' or 'json'
        sentry: {
            enabled: !!process.env.SENTRY_DSN,
            dsn: process.env.SENTRY_DSN
        }
    },

    // WebSocket Support
    websocket: {
        enabled: process.env.WEBSOCKET_ENABLED === 'true' || false,
        path: '/ws',
        maxConnections: parseInt(process.env.WS_MAX_CONNECTIONS) || 1000
    },

    // Geo-Routing (placeholder for future implementation)
    geoRouting: {
        enabled: process.env.GEO_ROUTING_ENABLED === 'true' || false,
        provider: process.env.GEO_PROVIDER || 'maxmind'
    }
};
