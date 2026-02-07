import sharp from "sharp";
import { logger } from "./logger.js";

export async function optimizeImage(buffer, params) {
    try {
        let pipeline = sharp(buffer);

        const metadata = await pipeline.metadata();
        const { width, height, quality, format } = params;

        // Resize if width or height provided
        if (width || height) {
            pipeline = pipeline.resize({
                width: width ? parseInt(width) : null,
                height: height ? parseInt(height) : null,
                fit: "inside",
                withoutEnlargement: true
            });
        }

        // Auto-format or explicit format
        if (format) {
            pipeline = pipeline.toFormat(format, { quality: quality ? parseInt(quality) : 80 });
        } else if (metadata.format === 'jpeg' || metadata.format === 'png') {
            // Default to webp for common formats if not specified
            pipeline = pipeline.toFormat('webp', { quality: quality ? parseInt(quality) : 80 });
        } else {
            pipeline = pipeline.toFormat(metadata.format, { quality: quality ? parseInt(quality) : 80 });
        }

        const optimizedBuffer = await pipeline.toBuffer();

        return {
            buffer: optimizedBuffer,
            format: format || (metadata.format === 'jpeg' || metadata.format === 'png' ? 'webp' : metadata.format),
            contentType: `image/${format || (metadata.format === 'jpeg' || metadata.format === 'png' ? 'webp' : metadata.format)}`
        };
    } catch (err) {
        logger.error("Image optimization failed", { error: err.message });
        return { buffer, format: null, contentType: null }; // Return original on failure
    }
}
