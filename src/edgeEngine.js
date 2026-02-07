import vm from "vm";
import { logger } from "./logger.js";

/**
 * Continuum Edge Logic Engine
 * Allows running custom JS snippets at the edge.
 */
export async function executeEdgeRule(rule, req, res, phase = 'request') {
    if (!rule || !rule.script) return;

    const sandbox = {
        request: {
            url: req.url,
            method: req.method,
            headers: req.headers,
            ip: req.socket.remoteAddress
        },
        response: {
            headers: res.getHeaders ? res.getHeaders() : {},
            statusCode: res.statusCode
        },
        console: {
            log: (...args) => logger.debug("Edge Script Log:", { args }),
            error: (...args) => logger.error("Edge Script Error:", { args })
        },
        // Utilities
        setResponseHeader: (name, value) => {
            res.setHeader(name, value);
        },
        redirect: (url, code = 302) => {
            res.writeHead(code, { Location: url });
            res.end();
            return 'STOP'; // Special signal to stop processing
        }
    };

    try {
        const script = new vm.Script(rule.script);
        const context = vm.createContext(sandbox);
        const result = await script.runInContext(context, { timeout: 100 }); // 100ms timeout for safety

        // Check if script requested to stop (e.g. redirect)
        if (result === 'STOP' || sandbox.STOP === true) {
            return { stop: true };
        }
    } catch (err) {
        logger.error("Edge Rule Execution Failed", { error: err.message, ruleId: rule.id });
    }

    return { stop: false };
}
