import fs from "fs";
import { config } from "./config.js";
import Redis from "ioredis";
import { logger } from "./logger.js";

const DOMAINS_FILE = "./src/domains.json";

// Redis for distributed state
let redis = null;
let redisConnected = false;

if (config.redis.enabled) {
    try {
        redis = new Redis({
            host: config.redis.host,
            port: config.redis.port,
            password: config.redis.password,
            db: config.redis.db || 0,
            retryStrategy: (times) => {
                if (times > 3) {
                    logger.warn("DomainManager: Redis connection failed after 3 retries");
                    return null;
                }
                return Math.min(times * 50, 2000);
            },
            lazyConnect: true,
            maxRetriesPerRequest: 3,
            enableOfflineQueue: false
        });

        redis.on('error', (err) => {
            redisConnected = false;
            logger.warn("DomainManager: Redis error", { error: err.message });
        });

        redis.on('connect', () => {
            redisConnected = true;
            logger.info("DomainManager: Redis connected");
        });

        redis.on('ready', () => {
            redisConnected = true;
        });

        redis.on('close', () => {
            redisConnected = false;
        });

        redis.connect().catch((err) => {
            logger.warn("DomainManager: Could not connect to Redis", { error: err.message });
            redis = null;
        });
    } catch (err) {
        logger.error("DomainManager: Redis initialization error", { error: err.message });
        redis = null;
    }
} else {
    logger.info("DomainManager: Redis disabled");
}

let domains = {};
let lastSync = 0;
const SYNC_INTERVAL = 5000;

// Initial Load
if (fs.existsSync(DOMAINS_FILE)) {
    try {
        domains = JSON.parse(fs.readFileSync(DOMAINS_FILE, "utf-8"));
    } catch (e) {
        logger.error("Failed to load domains file", { error: e.message });
    }
}

// Sync from Redis Helper
async function syncFromRedis() {
    if (!redis || !redisConnected) return;
    try {
        const data = await redis.hgetall("Continuum:domains");
        if (data && Object.keys(data).length > 0) {
            const parsed = {};
            for (const [k, v] of Object.entries(data)) {
                parsed[k] = JSON.parse(v);
            }
            // Merge but prioritize Redis
            domains = { ...domains, ...parsed };
        }
    } catch (e) {
        logger.warn("Failed to sync from Redis", { error: e.message });
    }
}

export const domainManager = {
    async getOrigin(hostname) {
        const now = Date.now();
        if (now - lastSync > SYNC_INTERVAL && redis) {
            lastSync = now;
            syncFromRedis();
        }

        const entry = domains[hostname];
        if (!entry) return null;
        if (typeof entry === 'string') return entry;
        if (entry.active === false) return null;

        if (Array.isArray(entry.origin)) {
            const health = entry.health || [];
            const healthyOrigins = entry.origin.filter((o, i) => health[i]?.healthy);
            return healthyOrigins.length > 0 ? healthyOrigins[0] : entry.origin[0];
        }

        return entry.origin;
    },

    getConfig(hostname) {
        const entry = domains[hostname];
        if (!entry) return null;
        if (typeof entry === 'string') return { origin: entry, plan: 'free', active: true };
        return entry;
    },

    updateHealthStatus(hostname, status) {
        if (domains[hostname]) {
            domains[hostname].health = status;
        }
    },

    async addDomain(hostname, origin, options = {}) {
        const domainConfig = {
            hostname,
            origin,
            plan: options.plan || "free",
            active: true,
            wafRules: options.wafRules || [],
            edgeRules: options.edgeRules || [],
            blockedIPs: options.blockedIPs || [],
            createdAt: new Date().toISOString()
        };

        domains[hostname] = domainConfig;

        // Save to disk (Backup)
        try {
            fs.writeFileSync(DOMAINS_FILE, JSON.stringify(domains, null, 2));
        } catch (e) {
            logger.error("Failed to save domains to disk", { error: e.message });
        }

        // Save to Redis (Global State)
        if (redis && redisConnected) {
            await redis.hset("Continuum:domains", hostname, JSON.stringify(domainConfig));
            await redis.publish("Continuum:config_update", JSON.stringify({ hostname }));
        }

        logger.info("Admin Added/Updated Domain", { hostname, origin, plan: domainConfig.plan });
        return domainConfig;
    },

    async removeDomain(hostname) {
        if (domains[hostname]) {
            delete domains[hostname];

            try {
                fs.writeFileSync(DOMAINS_FILE, JSON.stringify(domains, null, 2));
            } catch (e) { }

            if (redis && redisConnected) {
                await redis.hdel("Continuum:domains", hostname);
                await redis.publish("Continuum:config_update", JSON.stringify({ hostname }));
            }
            logger.info("Admin Removed Domain", { hostname });
            return true;
        }
        return false;
    },

    async loadFromRedis() {
        await syncFromRedis();
    },

    getAll() {
        return domains;
    }
};
