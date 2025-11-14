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

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`🚨 ${level.toUpperCase()} Log`)
      .setDescription(message.length > 4096 ? message.substring(0, 4093) + "..." : message)
      .setTimestamp(new Date(timestamp));

    // Add stack trace if available
    if (meta.stack) {
      const stackTrace = meta.stack.length > 1024 ? meta.stack.substring(0, 1021) + "..." : meta.stack;
      embed.addFields({ name: "Stack Trace", value: `\`\`\`${stackTrace}\`\`\`` });
    }

    // Add additional metadata
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
        const truncatedMeta = metaStr.length > 1024 ? metaStr.substring(0, 1021) + "..." : metaStr;
        embed.addFields({ name: "Metadata", value: `\`\`\`json\n${truncatedMeta}\n\`\`\`` });
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
