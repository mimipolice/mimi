import { generateFromMessages } from 'discord-html-transcripts';
import { TextChannel } from 'discord.js';

export async function generateTranscript(channel: TextChannel) {
    const messages = await channel.messages.fetch({ limit: 100 });
    return generateFromMessages(messages.reverse(), channel);
}
