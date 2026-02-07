import fs from "fs";
import path from "path";

const ANALYTICS_FILE = "./analytics.json";
const HISTORY_LIMIT = 60; // Keep last 60 data points (e.g., minutes)

let stats = {
    totalRequests: 0,
    hits: 0,
    misses: 0,
    errors: 0,
    blocked: 0,
    bandwidth: 0,
    lastUpdate: Date.now(),
    history: [], // [{ timestamp, hits, misses, errors, bandwidth }]
    domains: {}
};

// Load existing stats if any
if (fs.existsSync(ANALYTICS_FILE)) {
    try {
        stats = JSON.parse(fs.readFileSync(ANALYTICS_FILE, "utf-8"));
        if (!stats.domains) stats.domains = {};
        if (!stats.history) stats.history = [];
        if (stats.blocked === undefined) stats.blocked = 0;
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
            blocked: 0,
            bandwidth: 0
        };
    }
}

function updateHistory(type, bytes = 0) {
    const now = Math.floor(Date.now() / 60000) * 60000; // Minute bucket
    let currentPoint = stats.history.find(p => p.timestamp === now);

    if (!currentPoint) {
        currentPoint = { timestamp: now, hits: 0, misses: 0, errors: 0, blocked: 0, bandwidth: 0 };
        stats.history.push(currentPoint);
        // Keep only the last HISTORY_LIMIT points
        if (stats.history.length > HISTORY_LIMIT) {
            stats.history.shift();
        }
    }

    if (type === "HIT") currentPoint.hits++;
    else if (type === "MISS") currentPoint.misses++;
    else if (type === "ERROR") currentPoint.errors++;
    else if (type === "BLOCKED") currentPoint.blocked++;

    currentPoint.bandwidth += bytes;
}

export function logRequest(type, hostname = 'unknown') {
    stats.totalRequests++;

    if (type === "HIT") stats.hits++;
    else if (type === "MISS") stats.misses++;
    else if (type === "ERROR") stats.errors++;
    else if (type === "BLOCKED") stats.blocked++;

    initDomainStats(hostname);
    stats.domains[hostname].totalRequests++;
    if (type === "HIT") stats.domains[hostname].hits++;
    else if (type === "MISS") stats.domains[hostname].misses++;
    else if (type === "ERROR") stats.domains[hostname].errors++;
    else if (type === "BLOCKED") stats.domains[hostname].blocked++;

    updateHistory(type);
    saveStats();
}

export function logBandwidth(bytes, hostname = 'unknown') {
    stats.bandwidth += bytes;
    initDomainStats(hostname);
    stats.domains[hostname].bandwidth += bytes;
    updateHistory(null, bytes);
    saveStats();
}

export function saveStats() {
    stats.lastUpdate = Date.now();
    try {
        fs.writeFileSync(ANALYTICS_FILE, JSON.stringify(stats, null, 2));
    } catch (e) { }
}

export function getStats() {
    return stats;
}
