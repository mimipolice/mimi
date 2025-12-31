import { generateFromMessages } from "discord-html-transcripts";
import { TextChannel, AttachmentBuilder } from "discord.js";
import fs from "fs";
import path from "path";
import logger from "../logger";
import { uploadToR2, isR2Configured } from "../r2";

export interface OGMetadata {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  siteName?: string;
  type?: string;
}

/**
 * Generate a transcript with Open Graph meta tags
 * @param channel - The text channel to export
 * @param messageLimit - Number of messages to fetch
 * @param ogMetadata - Open Graph metadata to inject
 * @returns Object containing the attachment and local file path
 */
export async function generateTranscriptWithOG(
  channel: TextChannel,
  messageLimit: number = 100,
  ogMetadata?: OGMetadata
): Promise<{ attachment: AttachmentBuilder; filePath: string | null; publicUrl: string | null }> {
  try {
    // Fetch messages
    const messages = await channel.messages.fetch({ limit: messageLimit });

    if (messages.size === 0) {
      throw new Error("No messages found in this channel.");
    }

    logger.info(
      `Fetched ${messages.size} messages from channel ${channel.id} (${channel.name})`
    );

    // Generate HTML transcript
    const transcriptAttachment = (await generateFromMessages(
      messages.reverse(),
      channel,
      {
        saveImages: false,
        poweredBy: true,
      }
    )) as AttachmentBuilder;

    let transcriptBuffer = transcriptAttachment.attachment as Buffer;
    let htmlContent = transcriptBuffer.toString("utf-8");

    // Inject Open Graph meta tags if provided
    if (ogMetadata) {
      htmlContent = injectOGTags(htmlContent, ogMetadata);
      transcriptBuffer = Buffer.from(htmlContent, "utf-8");
    }

    const fileName = `transcript-${channel.id}-${Date.now()}.html`;
    let filePath: string | null = null;
    let publicUrl: string | null = null;

    // Try R2 first (preferred - no exposed ports)
    if (isR2Configured()) {
      const result = await uploadToR2({
        key: fileName,
        body: transcriptBuffer,
        contentType: "text/html; charset=utf-8",
        prefix: "transcripts",
        cacheControl: "public, max-age=31536000", // 1 year
      });

      if (result.success && result.url) {
        logger.info(`Transcript with OG tags uploaded to R2: ${result.url}`);
        publicUrl = result.url;
      } else {
        logger.warn(`R2 upload failed: ${result.error}. Falling back to local storage.`);
      }
    }

    // Fallback to local filesystem if R2 failed or not configured
    if (!publicUrl && process.env.TRANSCRIPT_PATH) {
      filePath = path.join(process.env.TRANSCRIPT_PATH, fileName);

      try {
        fs.writeFileSync(filePath, transcriptBuffer);
        logger.info(`Saved transcript with OG tags to: ${filePath}`);

        // Generate public URL if base URL is configured
        if (process.env.TRANSCRIPT_BASE_URL) {
          publicUrl = new URL(fileName, process.env.TRANSCRIPT_BASE_URL).toString();
          logger.info(`Public URL: ${publicUrl}`);
        }
      } catch (error) {
        logger.error(`Failed to save transcript locally:`, error);
        filePath = null;
      }
    }

    // Create new attachment with modified content
    const modifiedAttachment = new AttachmentBuilder(transcriptBuffer, {
      name: `transcript-${channel.name}-${Date.now()}.html`,
    });

    return {
      attachment: modifiedAttachment,
      filePath,
      publicUrl,
    };
  } catch (error) {
    logger.error(`Failed to generate transcript with OG tags:`, error);
    throw error;
  }
}

/**
 * Inject Open Graph meta tags into HTML content
 * @param html - Original HTML content
 * @param metadata - OG metadata to inject
 * @returns Modified HTML with OG tags
 */
function injectOGTags(html: string, metadata: OGMetadata): string {
  const ogTags: string[] = [];

  // Build OG meta tags
  if (metadata.title) {
    ogTags.push(`<meta property="og:title" content="${escapeHtml(metadata.title)}" />`);
    ogTags.push(`<meta name="twitter:title" content="${escapeHtml(metadata.title)}" />`);
  }

  if (metadata.description) {
    ogTags.push(`<meta property="og:description" content="${escapeHtml(metadata.description)}" />`);
    ogTags.push(`<meta name="twitter:description" content="${escapeHtml(metadata.description)}" />`);
  }

  if (metadata.image) {
    ogTags.push(`<meta property="og:image" content="${escapeHtml(metadata.image)}" />`);
    ogTags.push(`<meta name="twitter:image" content="${escapeHtml(metadata.image)}" />`);
    ogTags.push(`<meta name="twitter:card" content="summary_large_image" />`);
  }

  if (metadata.url) {
    ogTags.push(`<meta property="og:url" content="${escapeHtml(metadata.url)}" />`);
  }

  if (metadata.siteName) {
    ogTags.push(`<meta property="og:site_name" content="${escapeHtml(metadata.siteName)}" />`);
  }

  if (metadata.type) {
    ogTags.push(`<meta property="og:type" content="${escapeHtml(metadata.type)}" />`);
  } else {
    ogTags.push(`<meta property="og:type" content="website" />`);
  }

  // Add charset and viewport for better compatibility
  ogTags.unshift(`<meta charset="UTF-8" />`);
  ogTags.unshift(`<meta name="viewport" content="width=device-width, initial-scale=1.0" />`);

  const ogTagsString = ogTags.join("\n    ");

  // Try to inject after <head> tag
  if (html.includes("<head>")) {
    return html.replace("<head>", `<head>\n    ${ogTagsString}`);
  }

  // Fallback: inject before </head> tag
  if (html.includes("</head>")) {
    return html.replace("</head>", `    ${ogTagsString}\n  </head>`);
  }

  // Last resort: inject at the beginning
  return `<!DOCTYPE html>\n<html>\n<head>\n    ${ogTagsString}\n</head>\n<body>\n${html}\n</body>\n</html>`;
}

/**
 * Escape HTML special characters to prevent XSS
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}
