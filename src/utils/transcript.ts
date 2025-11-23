import { generateFromMessages } from 'discord-html-transcripts';
import { TextChannel } from 'discord.js';
import fs from 'fs';
import path from 'path';
import logger from './logger';

import { AttachmentBuilder } from 'discord.js';

export async function generateTranscript(channel: TextChannel): Promise<string | null> {
    if (!process.env.TRANSCRIPT_PATH || !process.env.TRANSCRIPT_BASE_URL) {
        logger.error('TRANSCRIPT_PATH or TRANSCRIPT_BASE_URL is not set in the environment variables.');
        return null;
    }

    const messages = await channel.messages.fetch({ limit: 100 });
    const attachment = await generateFromMessages(messages.reverse(), channel) as AttachmentBuilder;

    let transcriptBuffer = attachment.attachment as Buffer;
    let htmlContent = transcriptBuffer.toString('utf-8');

    // Inject Open Graph meta tags for better link previews
    const guild = channel.guild;
    const ogMetadata = {
        title: `Ticket Transcript - ${channel.name}`,
        description: `Chat transcript from ${guild.name}`,
        siteName: guild.name,
        type: 'website',
    };

    htmlContent = injectOGTags(htmlContent, ogMetadata);
    transcriptBuffer = Buffer.from(htmlContent, 'utf-8');

    const fileName = `transcript-${channel.id}-${Date.now()}.html`;
    const savePath = path.join(process.env.TRANSCRIPT_PATH, fileName);

    try {
        fs.writeFileSync(savePath, transcriptBuffer);
        const publicUrl = new URL(fileName, process.env.TRANSCRIPT_BASE_URL).toString();
        return publicUrl;
    } catch (error) {
        if (error instanceof Error) {
            logger.error(`Failed to save transcript: ${error.message}`);
        } else {
            logger.error('Failed to save transcript due to an unknown error.');
        }
        return null;
    }
}

/**
 * Inject Open Graph meta tags into HTML content
 */
function injectOGTags(html: string, metadata: {
    title?: string;
    description?: string;
    image?: string;
    url?: string;
    siteName?: string;
    type?: string;
}): string {
    const ogTags: string[] = [];

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
    }

    ogTags.unshift(`<meta charset="UTF-8" />`);
    ogTags.unshift(`<meta name="viewport" content="width=device-width, initial-scale=1.0" />`);

    const ogTagsString = ogTags.join('\n    ');

    // Try to inject after <head> tag
    if (html.includes('<head>')) {
        return html.replace('<head>', `<head>\n    ${ogTagsString}`);
    }

    // Fallback: inject before </head> tag
    if (html.includes('</head>')) {
        return html.replace('</head>', `    ${ogTagsString}\n  </head>`);
    }

    // Last resort: inject at the beginning
    return `<!DOCTYPE html>\n<html>\n<head>\n    ${ogTagsString}\n</head>\n<body>\n${html}\n</body>\n</html>`;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
    const map: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (char) => map[char]);
}
