export const wafRules = {
    sqlInjection: /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION)\b)|(')|(--)/i,
    xss: /(<script>|javascript:|on\w+=)/i,
    pathTraversal: /(\.\.\/|\.\.\\)/,
    git: /\.git/
};

export function checkWAF(req) {
    const url = req.url;
    // Check URL for malicious patterns
    if (wafRules.sqlInjection.test(url)) return { blocked: true, reason: "SQL Injection Attempt" };
    if (wafRules.xss.test(url)) return { blocked: true, reason: "XSS Attempt" };
    if (wafRules.pathTraversal.test(url)) return { blocked: true, reason: "Path Traversal" };
    if (wafRules.git.test(url)) return { blocked: true, reason: "Git Access Denied" };

    return { blocked: false };
}
