import fs from "fs";
import path from "path";

const ANALYTICS_FILE = "./analytics.json";

let stats = {
    totalRequests: 0,
    hits: 0,
    misses: 0,
    errors: 0,
    bandwidth: 0, // In bytes
    lastUpdate: Date.now(),
    history: [], // Last 60 minutes of data
    domains: {} // Per-domain stats
};

// Load existing stats if any
if (fs.existsSync(ANALYTICS_FILE)) {
    try {
        stats = JSON.parse(fs.readFileSync(ANALYTICS_FILE, "utf-8"));
        // Ensure domains object exists if loading old file
        if (!stats.domains) stats.domains = {};
    } catch (e) {
        console.error("Failed to load analytics:", e);
    }
}

function initDomainStats(hostname) {
    if (!stats.domains[hostname]) {
        stats.domains[hostname] = {
            totalRequests: 0,
            hits: 0,
            misses: 0,
            errors: 0,
            bandwidth: 0
        };
    }
}

export function logRequest(type, hostname = 'unknown') {
    stats.totalRequests++;

    // Global Stats
    if (type === "HIT") stats.hits++;
    else if (type === "MISS") stats.misses++;
    else if (type === "ERROR") stats.errors++;

    // Domain Stats
    initDomainStats(hostname);
    stats.domains[hostname].totalRequests++;
    if (type === "HIT") stats.domains[hostname].hits++;
    else if (type === "MISS") stats.domains[hostname].misses++;
    else if (type === "ERROR") stats.domains[hostname].errors++;

    saveStats();
}

export function logBandwidth(bytes, hostname = 'unknown') {
    stats.bandwidth += bytes;

    // Domain Stats
    initDomainStats(hostname);
    stats.domains[hostname].bandwidth += bytes;

    saveStats();
}

export function saveStats() {
    stats.lastUpdate = Date.now();
    fs.writeFileSync(ANALYTICS_FILE, JSON.stringify(stats, null, 2));
}

export function getStats() {
    return stats;
}
