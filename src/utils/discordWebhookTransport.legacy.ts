import Transport from "winston-transport";
import { EmbedBuilder, WebhookClient } from "discord.js";

interface DiscordWebhookTransportOptions extends Transport.TransportStreamOptions {
  webhookUrl: string;
  level?: string;
}

/**
 * Custom Winston transport that sends logs to a Discord webhook
 */
export class DiscordWebhookTransport extends Transport {
  private webhook: WebhookClient | null = null;
  private messageQueue: Array<{ level: string; message: string; timestamp: string; meta: any }> = [];
  private isProcessing = false;

  constructor(opts: DiscordWebhookTransportOptions) {
    super(opts);

    if (opts.webhookUrl) {
      try {
        this.webhook = new WebhookClient({ url: opts.webhookUrl });
      } catch (error) {
        console.error("Failed to initialize Discord webhook:", error);
      }
    }
  }

  log(info: any, callback: () => void) {
    setImmediate(() => {
      this.emit("logged", info);
    });

    if (!this.webhook) {
      callback();
      return;
    }

    // Add to queue
    this.messageQueue.push({
      level: info.level,
      message: info.message,
      timestamp: info.timestamp,
      meta: info,
    });

    // Process queue
    this.processQueue();

    callback();
  }

  private async processQueue() {
    if (this.isProcessing || this.messageQueue.length === 0 || !this.webhook) {
      return;
    }

    this.isProcessing = true;

    while (this.messageQueue.length > 0) {
      const logEntry = this.messageQueue.shift();
      if (!logEntry) continue;

      try {
        await this.sendToDiscord(logEntry);
        // Rate limit: wait 1 second between messages
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        console.error("Failed to send log to Discord webhook:", error);
        // If sending fails, don't retry to avoid infinite loops
      }
    }

    this.isProcessing = false;
  }

  private async sendToDiscord(logEntry: {
    level: string;
    message: string;
    timestamp: string;
    meta: any;
  }) {
    if (!this.webhook) return;

    const { level, message, timestamp, meta } = logEntry;

    // Determine color based on log level
    let color = 0x808080; // Gray for info
    if (level === "error") color = 0xff0000; // Red
    else if (level === "warn") color = 0xffa500; // Orange
    else if (level === "debug") color = 0x00ffff; // Cyan

    // Build description with message and stack trace (max 4096 chars)
    let description = message.length > 2000 ? message.substring(0, 1997) + "..." : message;
    
    if (meta.stack) {
      const stackPrefix = "\n\n**Stack Trace:**\n```";
      const stackSuffix = "```";
      const availableSpace = 4096 - description.length - stackPrefix.length - stackSuffix.length;
      
      if (availableSpace > 100) { // Only add if we have reasonable space
        const stackTrace = meta.stack.length > availableSpace
          ? meta.stack.substring(0, availableSpace - 3) + "..."
          : meta.stack;
        description += `${stackPrefix}${stackTrace}${stackSuffix}`;
      }
    }

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`🚨 ${level.toUpperCase()} Log`)
      .setDescription(description)
      .setTimestamp(new Date(timestamp));

    // Add additional metadata as a field (if any)
    const metaKeys = Object.keys(meta).filter(
      (key) => !["level", "message", "timestamp", "stack"].includes(key)
    );
    if (metaKeys.length > 0) {
      const metaStr = JSON.stringify(
        metaKeys.reduce((obj: any, key) => {
          obj[key] = meta[key];
          return obj;
        }, {}),
        null,
        2
      );
      if (metaStr.length > 0 && metaStr !== "{}") {
        // Discord field value limit is 1024 characters
        // Code block markers: ```json\n and \n``` = 11 chars
        // Truncation indicator: ... = 3 chars
        // Safe limit: 1024 - 11 - 3 = 1010 chars
        const codeBlockOverhead = 11;
        const truncationIndicator = 3;
        const maxMetaLength = 1024 - codeBlockOverhead - truncationIndicator;
        
        const truncatedMeta = metaStr.length > maxMetaLength
          ? metaStr.substring(0, maxMetaLength) + "..."
          : metaStr;
        
        const fieldValue = `\`\`\`json\n${truncatedMeta}\n\`\`\``;
        
        // Double-check the final length doesn't exceed 1024
        if (fieldValue.length <= 1024) {
          embed.addFields({ name: "Metadata", value: fieldValue });
        } else {
          // If still too long, use an even simpler format
          embed.addFields({
            name: "Metadata",
            value: `Metadata too large (${metaStr.length} chars). Check logs for details.`
          });
        }
      }
    }

    try {
      await this.webhook.send({
        embeds: [embed],
        username: "Bot Error Logger",
        avatarURL: "https://cdn.discordapp.com/emojis/1234567890.png", // Optional: customize
      });
    } catch (error: any) {
      // If the message is too long, send a simplified version
      if (error.code === 50035) {
        const simpleEmbed = new EmbedBuilder()
          .setColor(color)
          .setTitle(`🚨 ${level.toUpperCase()} Log`)
          .setDescription(message.substring(0, 500) + "...")
          .setTimestamp(new Date(timestamp));

        await this.webhook.send({
          embeds: [simpleEmbed],
          username: "Bot Error Logger",
        });
      } else {
        throw error;
      }
    }
  }

  close() {
    if (this.webhook) {
      this.webhook.destroy();
    }
  }
}
