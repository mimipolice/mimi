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

    const fileName = `transcript-${channel.id}-${Date.now()}.html`;
    const savePath = path.join(process.env.TRANSCRIPT_PATH, fileName);

    try {
        fs.writeFileSync(savePath, attachment.attachment as Buffer);
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
