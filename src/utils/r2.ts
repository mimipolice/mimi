/**
 * Cloudflare R2 Storage Utility
 *
 * Uses S3-compatible API to upload files to Cloudflare R2.
 * Requires the following environment variables:
 * - R2_ACCOUNT_ID: Cloudflare account ID
 * - R2_ACCESS_KEY_ID: R2 API access key ID
 * - R2_SECRET_ACCESS_KEY: R2 API secret access key
 * - R2_BUCKET_NAME: R2 bucket name
 * - R2_PUBLIC_URL: Public URL for the R2 bucket (e.g., https://transcripts.yourdomain.com)
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import logger from "./logger";

let s3Client: S3Client | null = null;

/**
 * Get or create the S3 client for R2
 */
function getR2Client(): S3Client | null {
    if (s3Client) return s3Client;

    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

    if (!accountId || !accessKeyId || !secretAccessKey) {
        logger.warn("R2 credentials not configured. File upload to R2 will be unavailable.");
        return null;
    }

    s3Client = new S3Client({
        region: "auto",
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId,
            secretAccessKey,
        },
    });

    return s3Client;
}

export interface R2UploadOptions {
    /** File name (key) in the bucket */
    key: string;
    /** File content as Buffer or string */
    body: Buffer | string;
    /** Content type (MIME type) */
    contentType?: string;
    /** Optional subdirectory/prefix */
    prefix?: string;
    /** Cache control header */
    cacheControl?: string;
}

export interface R2UploadResult {
    /** Whether the upload was successful */
    success: boolean;
    /** Public URL of the uploaded file */
    url?: string;
    /** Full key (prefix + filename) */
    key?: string;
    /** Error message if upload failed */
    error?: string;
}

/**
 * Upload a file to Cloudflare R2
 */
export async function uploadToR2(options: R2UploadOptions): Promise<R2UploadResult> {
    const client = getR2Client();
    const bucketName = process.env.R2_BUCKET_NAME;
    const publicUrl = process.env.R2_PUBLIC_URL;

    if (!client) {
        return {
            success: false,
            error: "R2 client not configured. Check R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY.",
        };
    }

    if (!bucketName) {
        return {
            success: false,
            error: "R2_BUCKET_NAME not configured.",
        };
    }

    if (!publicUrl) {
        return {
            success: false,
            error: "R2_PUBLIC_URL not configured.",
        };
    }

    const fullKey = options.prefix ? `${options.prefix}/${options.key}` : options.key;

    try {
        const command = new PutObjectCommand({
            Bucket: bucketName,
            Key: fullKey,
            Body: options.body,
            ContentType: options.contentType || "application/octet-stream",
            CacheControl: options.cacheControl || "public, max-age=31536000", // 1 year cache
        });

        await client.send(command);

        const fileUrl = new URL(fullKey, publicUrl).toString();

        logger.info(`Successfully uploaded to R2: ${fullKey}`);

        return {
            success: true,
            url: fileUrl,
            key: fullKey,
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        logger.error(`Failed to upload to R2: ${errorMessage}`, error);
        return {
            success: false,
            error: errorMessage,
        };
    }
}

/**
 * Delete a file from Cloudflare R2
 */
export async function deleteFromR2(key: string): Promise<boolean> {
    const client = getR2Client();
    const bucketName = process.env.R2_BUCKET_NAME;

    if (!client || !bucketName) {
        logger.warn("R2 not configured, cannot delete file");
        return false;
    }

    try {
        const command = new DeleteObjectCommand({
            Bucket: bucketName,
            Key: key,
        });

        await client.send(command);
        logger.info(`Successfully deleted from R2: ${key}`);
        return true;
    } catch (error) {
        logger.error(`Failed to delete from R2: ${key}`, error);
        return false;
    }
}

/**
 * Check if R2 is properly configured
 */
export function isR2Configured(): boolean {
    return !!(
        process.env.R2_ACCOUNT_ID &&
        process.env.R2_ACCESS_KEY_ID &&
        process.env.R2_SECRET_ACCESS_KEY &&
        process.env.R2_BUCKET_NAME &&
        process.env.R2_PUBLIC_URL
    );
}
