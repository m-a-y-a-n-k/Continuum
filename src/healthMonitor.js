import http from "http";
import https from "https";
import { domainManager } from "./domainManager.js";
import { logger } from "./logger.js";

const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds

let intervalId = null;

export function startHealthMonitor() {
    if (intervalId) return;

    logger.info("🏥 Health Monitor started");
    intervalId = setInterval(checkAllOrigins, HEALTH_CHECK_INTERVAL);
    checkAllOrigins(); // Initial check
}

async function checkAllOrigins() {
    const domains = domainManager.getAll();
    const hostnames = Object.keys(domains);

    for (const hostname of hostnames) {
        const config = domains[hostname];
        const origins = Array.isArray(config.origin) ? config.origin : [config.origin];

        const healthStatus = [];

        for (const originUrl of origins) {
            try {
                const isHealthy = await pingOrigin(originUrl);
                healthStatus.push({ origin: originUrl, healthy: isHealthy, lastChecked: new Date().toISOString() });
            } catch (err) {
                healthStatus.push({ origin: originUrl, healthy: false, lastChecked: new Date().toISOString(), error: err.message });
            }
        }

        // Update domain config with health status (without persisting every time to avoid disk IO, 
        // but we can keep it in memory via domainManager)
        domainManager.updateHealthStatus(hostname, healthStatus);
    }
}

function pingOrigin(urlStr) {
    return new Promise((resolve) => {
        try {
            const url = new URL(urlStr);
            const protocol = url.protocol === "https:" ? https : http;

            const req = protocol.get(urlStr, { timeout: 5000 }, (res) => {
                resolve(res.statusCode >= 200 && res.statusCode < 400);
            });

            req.on("error", () => resolve(false));
            req.on("timeout", () => {
                req.destroy();
                resolve(false);
            });
        } catch (e) {
            resolve(false);
        }
    });
}
