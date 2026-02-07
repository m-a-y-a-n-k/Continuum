import fs from "fs";
import { config } from "./config.js";
import Redis from "ioredis";
import { logger } from "./logger.js";

const DOMAINS_FILE = "./src/domains.json";

// Redis for distributed state
let redis = null;
if (config.redis.enabled) {
    redis = new Redis({
        host: config.redis.host,
        port: config.redis.port,
        lazyConnect: true
    });
    redis.on('error', () => { });
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
    if (!redis || redis.status !== 'ready') return;
    try {
        const data = await redis.hgetall("pravah:domains");
        if (data && Object.keys(data).length > 0) {
            const parsed = {};
            for (const [k, v] of Object.entries(data)) {
                parsed[k] = JSON.parse(v);
            }
            // Merge but prioritize Redis
            domains = { ...domains, ...parsed };
        }
    } catch (e) {
        // Silently fail, rely on local cache
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
        if (redis && redis.status === 'ready') {
            await redis.hset("pravah:domains", hostname, JSON.stringify(domainConfig));
            await redis.publish("pravah:config_update", JSON.stringify({ hostname }));
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

            if (redis && redis.status === 'ready') {
                await redis.hdel("pravah:domains", hostname);
                await redis.publish("pravah:config_update", JSON.stringify({ hostname }));
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
