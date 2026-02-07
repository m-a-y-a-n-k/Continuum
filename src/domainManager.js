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
    redis.on('error', () => { }); // Silence errors here, main loop handles them
}

// Local Memory Cache (L1)
let domains = {};
let lastSync = 0;
const SYNC_INTERVAL = 5000; // Sync with Redis every 5 seconds

// Load local backup on startup
if (fs.existsSync(DOMAINS_FILE)) {
    try {
        domains = JSON.parse(fs.readFileSync(DOMAINS_FILE, "utf-8"));
    } catch (e) {
        logger.error("Failed to load domains file", { error: e.message });
    }
}

// Watch for file changes (Robut Polling for Atomic Writes)
try {
    // interval: 1000ms is plenty fast for config changes
    fs.watchFile(DOMAINS_FILE, { interval: 1000 }, (curr, prev) => {
        if (curr.mtime !== prev.mtime) {
            try {
                const fileContent = fs.readFileSync(DOMAINS_FILE, "utf-8");
                if (fileContent) {
                    const newDomains = JSON.parse(fileContent);
                    domains = { ...domains, ...newDomains };
                    logger.info("Reloaded domains configuration from disk");
                }
            } catch (e) {
                logger.error("Failed to hot-reload domains file", { error: e.message });
            }
        }
    });
} catch (e) {
    logger.warn("Could not set up file watcher for domains.json", { error: e.message });
}

// Persist to disk (Backup)
function saveToDisk() {
    try {
        const tempFile = `${DOMAINS_FILE}.tmp`;
        fs.writeFileSync(tempFile, JSON.stringify(domains, null, 2));
        fs.renameSync(tempFile, DOMAINS_FILE); // Atomic write
    } catch (e) {
        logger.error("Failed to save domains to disk", { error: e.message });
    }
}

// Sync from Redis
async function syncFromRedis() {
    if (!redis || redis.status !== 'ready') return;
    try {
        const data = await redis.hgetall("pravah:domains");
        if (data && Object.keys(data).length > 0) {
            domains = { ...domains, ...data };
            saveToDisk(); // Update local backup
        }
    } catch (e) {
        // Silently fail, rely on local cache
    }
}

export const domainManager = {
    // Fast in-memory lookup, but try to sync slightly often
    async getOrigin(hostname) {
        const now = Date.now();
        if (now - lastSync > SYNC_INTERVAL && redis) {
            lastSync = now;
            syncFromRedis(); // Fire and forget update
        }

        const entry = domains[hostname];
        if (!entry) return null;

        // Handle both legacy string format and new object format
        if (typeof entry === 'string') return entry;
        return entry.active !== false ? entry.origin : null;
    },

    // Gets the full configuration for a domain
    getConfig(hostname) {
        const entry = domains[hostname];
        if (!entry) return null;
        if (typeof entry === 'string') return { origin: entry, plan: 'free', active: true };
        return entry;
    },

    // Adds/Updates a domain dynamically in Redis + Local
    async addDomain(hostname, origin, plan = "free") {
        const domainConfig = {
            origin,
            plan,
            active: true,
            createdAt: new Date().toISOString()
        };

        domains[hostname] = domainConfig;
        saveToDisk();

        if (redis && redis.status === 'ready') {
            await redis.hset("pravah:domains", hostname, JSON.stringify(domainConfig));
        }

        logger.info("Admin Added/Updated Domain", { hostname, origin, plan });
        return true;
    },

    // Removes a domain dynamically
    async removeDomain(hostname) {
        if (domains[hostname]) {
            delete domains[hostname];
            saveToDisk();

            if (redis && redis.status === 'ready') {
                await redis.hdel("pravah:domains", hostname);
            }

            logger.info("Admin Removed Domain", { hostname });
            return true;
        }
        return false;
    },

    getAll() {
        return domains;
    }
};
