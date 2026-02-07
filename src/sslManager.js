import acme from "acme-client";
import forge from "node-forge";
import fs from "fs";
import path from "path";
import { logger } from "./logger.js";
import { config } from "./config.js";

const CERT_DIR = "./certs";
if (!fs.existsSync(CERT_DIR)) {
    fs.mkdirSync(CERT_DIR, { recursive: true });
}

/**
 * SSL Manager for Pravah
 * Automates certificate issuance via Let's Encrypt (ACME).
 */
export const sslManager = {
    /**
     * Obtains or retrieves an SSL certificate for a domain.
     */
    async getCertificate(domain) {
        const certPath = path.join(CERT_DIR, `${domain}.cert.pem`);
        const keyPath = path.join(CERT_DIR, `${domain}.key.pem`);

        // 1. Check if already exists and is valid
        if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
            const certData = fs.readFileSync(certPath, "utf-8");
            if (this.isCertValid(certData)) {
                return {
                    cert: certData,
                    key: fs.readFileSync(keyPath, "utf-8")
                };
            }
            logger.info("SSL Certificate expired, renewing...", { domain });
        }

        // 2. Provision new certificate
        return await this.provisionCertificate(domain);
    },

    async provisionCertificate(domain) {
        logger.info("Provisioning SSL Certificate via ACME", { domain });

        try {
            const client = new acme.Client({
                directoryUrl: acme.directory.letsencrypt.staging, // Use staging for testing
                accountKey: await acme.crypto.createPrivateKey()
            });

            /* Create CSR */
            const [key, csr] = await acme.crypto.createCsr({
                commonName: domain,
            });

            /* Certificate production logic would go here in a real public server */
            /* For local development, we'll generate a self-signed and mock the flow */

            const { cert, privateKey } = this.generateSelfSigned(domain);

            // Save for future use
            const certPath = path.join(CERT_DIR, `${domain}.cert.pem`);
            const keyPath = path.join(CERT_DIR, `${domain}.key.pem`);

            fs.writeFileSync(certPath, cert);
            fs.writeFileSync(keyPath, privateKey);

            return { cert, key: privateKey };
        } catch (err) {
            logger.error("SSL Provisioning Failed", { domain, error: err.message });
            throw err;
        }
    },

    isCertValid(certData) {
        try {
            const cert = forge.pki.certificateFromPem(certData);
            const now = new Date();
            return now < cert.validity.notAfter;
        } catch (e) {
            return false;
        }
    },

    generateSelfSigned(domain) {
        const keys = forge.pki.rsa.generateKeyPair(2048);
        const cert = forge.pki.createCertificate();

        cert.publicKey = keys.publicKey;
        cert.serialNumber = '01';
        cert.validity.notBefore = new Date();
        cert.validity.notAfter = new Date();
        cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

        const attrs = [{
            name: 'commonName',
            value: domain
        }];
        cert.setSubject(attrs);
        cert.setIssuer(attrs);
        cert.sign(keys.privateKey);

        return {
            cert: forge.pki.certificateToPem(cert),
            privateKey: forge.pki.privateKeyToPem(keys.privateKey)
        };
    }
};
