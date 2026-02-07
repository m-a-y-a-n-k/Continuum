export const wafRules = {
    sqlInjection: /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION)\b)|(')|(--)/i,
    xss: /(<script>|javascript:|on\w+=)/i,
    pathTraversal: /(\.\.\/|\.\.\\)/,
    git: /\.git/
};

// Mocked IP Threat Intelligence
const THREAT_IPS = new Set(['1.2.3.4', '1.1.1.1']); // Example malicious IPs

export function checkWAF(req, domainConfig = {}) {
    const url = req.url;
    const ip = req.socket.remoteAddress;

    // 1. IP Threat Intelligence
    if (THREAT_IPS.has(ip)) {
        return { blocked: true, reason: "Malicious IP (Threat Intelligence)" };
    }

    // 2. Default Rules
    if (wafRules.sqlInjection.test(url)) return { blocked: true, reason: "SQL Injection Attempt" };
    if (wafRules.xss.test(url)) return { blocked: true, reason: "XSS Attempt" };
    if (wafRules.pathTraversal.test(url)) return { blocked: true, reason: "Path Traversal" };
    if (wafRules.git.test(url)) return { blocked: true, reason: "Git Access Denied" };

    // 3. Custom Rules from Domain Configuration
    const customRules = domainConfig.wafRules || [];
    for (const rule of customRules) {
        if (rule.active === false) continue;
        const regex = new RegExp(rule.pattern, 'i');
        if (regex.test(url)) {
            return { blocked: true, reason: rule.name || "Custom WAF Rule" };
        }
    }

    // 4. Custom Blocked IPs
    if (domainConfig.blockedIPs && domainConfig.blockedIPs.includes(ip)) {
        return { blocked: true, reason: "IP explicitly blocked for this domain" };
    }

    return { blocked: false };
}
