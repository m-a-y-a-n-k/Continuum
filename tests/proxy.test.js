import request from 'supertest';
import http from 'http';
import { handleRequest } from '../src/proxy.js';
import { config } from '../src/config.js';

// Mock Config to avoid Redis/Cluster dependency in tests
jest.mock('../src/config.js', () => ({
    config: {
        port: 5001,
        origin: 'https://httpbin.org',
        domains: { 'test.com': 'https://httpbin.org' },
        cacheDir: './test-cache',
        defaultTTL: 3600,
        compression: true,
        cluster: false,
        rateLimit: { windowMs: 1000, max: 100 },
        redis: { enabled: false }
    }
}));

// Mock Domain Manager
jest.mock('../src/domainManager.js', () => ({
    domainManager: {
        getOrigin: async (host) => {
            if (host === 'test.com') return 'https://httpbin.org';
            return null;
        }
    }
}));

// Mock Logger to silence output during tests
jest.mock('../src/logger.js', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    }
}));

// Mock Analytics
jest.mock('../src/analytics.js', () => ({
    logRequest: jest.fn(),
    logBandwidth: jest.fn()
}));

describe('Pravah Proxy', () => {
    let server;

    beforeAll(() => {
        server = http.createServer(handleRequest);
    });

    afterAll(() => {
        server.close();
    });

    test('Should return 404 for unknown domain', async () => {
        const res = await request(server)
            .get('/get')
            .set('Host', 'unknown.com');

        expect(res.statusCode).toBe(404);
        expect(res.text).toContain('Domain Not Configured');
    });

    test('Should proxy request for valid domain', async () => {
        // We use httpbin.org/status/200 as origin
        const res = await request(server)
            .get('/status/200')
            .set('Host', 'test.com');

        expect(res.statusCode).toBe(200);
    });

    test('WAF should block SQL injection', async () => {
        const res = await request(server)
            .get('/product?id=1 OR 1=1')
            .set('Host', 'test.com');

        expect(res.statusCode).toBe(403);
    });

    test('WAF should block XSS attempt', async () => {
        const res = await request(server)
            .get('/search?q=<script>alert(1)</script>')
            .set('Host', 'test.com');

        expect(res.statusCode).toBe(403);
    });
});
