import { generateFromMessages } from "discord-html-transcripts";
import {
  TextChannel,
  AttachmentBuilder,
  ThreadChannel,
  VoiceChannel,
  NewsChannel,
} from "discord.js";
import fs from "fs";
import path from "path";
import logger from "../logger";

type SupportedChannel =
  | TextChannel
  | ThreadChannel
  | VoiceChannel
  | NewsChannel;

/**
 * Generate a chat transcript for any channel and return as Discord attachment
 * @param channel - The channel to export (text, thread, voice, or news)
 * @param messageLimit - Number of messages to fetch (default: 100)
 * @returns Object containing the attachment and local file path
 */
export async function generateChatTranscript(
  channel: SupportedChannel,
  messageLimit: number = 100
): Promise<{ attachment: AttachmentBuilder; filePath: string | null }> {
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
      channel as any
    )) as AttachmentBuilder;

    let transcriptBuffer = transcriptAttachment.attachment as Buffer;
    let htmlContent = transcriptBuffer.toString("utf-8");

    // Inject Open Graph meta tags for better link previews
    const guild = channel.guild;
    const channelName = channel.isThread()
      ? `${channel.name} (Thread)`
      : channel.name;
    const ogMetadata = {
      title: `Chat Export - #${channelName}`,
      description: `Exported ${messages.size} messages from ${guild.name}`,
      siteName: guild.name,
      type: "website",
    };

    htmlContent = injectOGTags(htmlContent, ogMetadata);
    transcriptBuffer = Buffer.from(htmlContent, "utf-8");

    // Save to local file if TRANSCRIPT_PATH is configured
    let filePath: string | null = null;
    if (process.env.TRANSCRIPT_PATH) {
      const fileName = `chat-export-${channel.id}-${Date.now()}.html`;
      filePath = path.join(process.env.TRANSCRIPT_PATH, fileName);

      try {
        fs.writeFileSync(filePath, transcriptBuffer);
        logger.info(`Saved transcript with OG tags to: ${filePath}`);
      } catch (error) {
        logger.error(`Failed to save transcript locally:`, error);
        // Continue even if local save fails
        filePath = null;
      }
    }

    // Create new attachment with modified content
    const modifiedAttachment = new AttachmentBuilder(transcriptBuffer, {
      name: `chat-export-${channel.name}-${Date.now()}.html`,
    });

    return {
      attachment: modifiedAttachment,
      filePath,
    };
  } catch (error) {
    logger.error(`Failed to generate chat transcript:`, error);
    throw error;
  }
}

/**
 * Inject Open Graph meta tags into HTML content
 */
function injectOGTags(
  html: string,
  metadata: {
    title?: string;
    description?: string;
    image?: string;
    url?: string;
    siteName?: string;
    type?: string;
  }
): string {
  const ogTags: string[] = [];

  if (metadata.title) {
    ogTags.push(
      `<meta property="og:title" content="${escapeHtml(metadata.title)}" />`
    );
    ogTags.push(
      `<meta name="twitter:title" content="${escapeHtml(metadata.title)}" />`
    );
  }

  if (metadata.description) {
    ogTags.push(
      `<meta property="og:description" content="${escapeHtml(metadata.description)}" />`
    );
    ogTags.push(
      `<meta name="twitter:description" content="${escapeHtml(metadata.description)}" />`
    );
  }

  if (metadata.image) {
    ogTags.push(
      `<meta property="og:image" content="${escapeHtml(metadata.image)}" />`
    );
    ogTags.push(
      `<meta name="twitter:image" content="${escapeHtml(metadata.image)}" />`
    );
    ogTags.push(`<meta name="twitter:card" content="summary_large_image" />`);
  }

  if (metadata.url) {
    ogTags.push(
      `<meta property="og:url" content="${escapeHtml(metadata.url)}" />`
    );
  }

  if (metadata.siteName) {
    ogTags.push(
      `<meta property="og:site_name" content="${escapeHtml(metadata.siteName)}" />`
    );
  }

  if (metadata.type) {
    ogTags.push(
      `<meta property="og:type" content="${escapeHtml(metadata.type)}" />`
    );
  }

  ogTags.unshift(`<meta charset="UTF-8" />`);
  ogTags.unshift(
    `<meta name="viewport" content="width=device-width, initial-scale=1.0" />`
  );

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
 * Escape HTML special characters
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
