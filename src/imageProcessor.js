import sharp from "sharp";
import { logger } from "./logger.js";

export async function optimizeImage(buffer, params) {
    try {
        let pipeline = sharp(buffer);
        const metadata = await pipeline.metadata();
        const { width, height, quality, format, accept } = params;

        // Resize
        if (width || height) {
            pipeline = pipeline.resize({
                width: width ? parseInt(width) : null,
                height: height ? parseInt(height) : null,
                fit: "inside",
                withoutEnlargement: true
            });
        }

        let targetFormat = format;
        if (!targetFormat) {
            // Auto-format based on browser support (Accept header)
            if (accept && accept.includes("image/avif")) {
                targetFormat = "avif";
            } else if (accept && accept.includes("image/webp")) {
                targetFormat = "webp";
            } else {
                targetFormat = metadata.format;
            }
        }

        pipeline = pipeline.toFormat(targetFormat, {
            quality: quality ? parseInt(quality) : 80,
            effort: targetFormat === 'avif' ? 4 : 4 // Balance speed/compression
        });

        const optimizedBuffer = await pipeline.toBuffer();

        return {
            buffer: optimizedBuffer,
            format: targetFormat,
            contentType: `image/${targetFormat}`
        };
    } catch (err) {
        logger.error("Image optimization failed", { error: err.message });
        return { buffer, format: null, contentType: null };
    }
}
