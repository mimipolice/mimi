/**
 * Quick script to upload a single asset to R2
 *
 * Usage:
 *   npx ts-node src/scripts/upload-asset.ts <file-path> [prefix]
 *
 * Example:
 *   npx ts-node src/scripts/upload-asset.ts /path/to/banner.png assets
 */

import fs from "fs";
import path from "path";
import { uploadToR2, isR2Configured } from "../utils/r2";
import dotenv from "dotenv";

dotenv.config();

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.error("Usage: npx ts-node src/scripts/upload-asset.ts <file-path> [prefix]");
    console.error("Example: npx ts-node src/scripts/upload-asset.ts ./banner.png assets");
    process.exit(1);
  }

  const filePath = args[0];
  const prefix = args[1] || "assets";

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  if (!isR2Configured()) {
    console.error("R2 is not configured. Check your .env file.");
    process.exit(1);
  }

  const fileName = path.basename(filePath);
  const fileContent = fs.readFileSync(filePath);

  // Detect content type
  const ext = path.extname(fileName).toLowerCase();
  const contentTypes: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
  };
  const contentType = contentTypes[ext] || "application/octet-stream";

  console.log(`Uploading: ${fileName}`);
  console.log(`Prefix: ${prefix}`);
  console.log(`Content-Type: ${contentType}`);
  console.log(`Size: ${(fileContent.length / 1024).toFixed(2)} KB`);

  const result = await uploadToR2({
    key: fileName,
    body: fileContent,
    contentType,
    prefix,
    cacheControl: "public, max-age=31536000",
  });

  if (result.success) {
    console.log(`\n✅ Upload successful!`);
    console.log(`URL: ${result.url}`);
  } else {
    console.error(`\n❌ Upload failed: ${result.error}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
