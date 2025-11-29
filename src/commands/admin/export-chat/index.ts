import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  Locale,
  AttachmentBuilder,
} from "discord.js";
import { Command, Databases, Services } from "../../../interfaces/Command";
import { MessageFlags } from "discord-api-types/v10";
import { generateChatTranscript } from "../../../utils/transcript/chatTranscript";
import { createMissingPermissionsReply } from "../../../utils/interactionReply";
import logger from "../../../utils/logger";

export const command: Command = {
  guildOnly: true, // Only available in DEV_GUILD_ID
  data: new SlashCommandBuilder()
    .setName("export-chat")
    .setDescription("Export chat history of the current channel as an HTML file.")
    .setNameLocalizations({
      [Locale.ChineseTW]: "匯出聊天紀錄",
    })
    .setDescriptionLocalizations({
      [Locale.ChineseTW]: "將目前頻道的聊天紀錄匯出為 HTML 檔案。",
    })
    .addIntegerOption((option) =>
      option
        .setName("limit")
        .setDescription("Number of messages to export (default: 100, max: 1000)")
        .setNameLocalizations({
          [Locale.ChineseTW]: "訊息數量",
        })
        .setDescriptionLocalizations({
          [Locale.ChineseTW]: "要匯出的訊息數量（預設：100，最多：1000）",
        })
        .setMinValue(1)
        .setMaxValue(1000)
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(
    interaction,
    client,
    { localizationManager }: Services,
    _databases: Databases
  ) {
    if (!interaction.isChatInputCommand()) return;

    // Check permissions
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      const replyOptions = createMissingPermissionsReply(
        localizationManager,
        interaction
      );
      await interaction.reply({
        embeds: replyOptions.embeds,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Validate channel type - support text channels, threads, and voice text channels
    const channel = interaction.channel;
    if (!channel) {
      await interaction.reply({
        content: "❌ Unable to access this channel.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const supportedChannelTypes = [
      ChannelType.GuildText,
      ChannelType.PublicThread,
      ChannelType.PrivateThread,
      ChannelType.GuildVoice,
    ];

    if (!supportedChannelTypes.includes(channel.type)) {
      await interaction.reply({
        content: "❌ This command can only be used in text channels, threads, or voice channels.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const limit = interaction.options.getInteger("limit") || 100;
      
      const channelName =
        "name" in channel ? channel.name : `Channel ${channel.id}`;
      logger.info(
        `Exporting ${limit} messages from channel ${channel.id} (${channelName}) by ${interaction.user.tag}`
      );

      // Generate transcript (cast to TextChannel for compatibility)
      const { attachment, filePath } = await generateChatTranscript(
        channel as any,
        limit
      );

      // Upload to Discord
      await interaction.editReply({
        content: `✅ Chat history exported successfully (${limit} messages).`,
        files: [attachment],
      });

      logger.info(
        `Successfully exported chat from channel ${channel.id}, file will be auto-deleted`
      );

      // Delete local file after upload
      if (filePath) {
        const fs = await import("fs");
        setTimeout(() => {
          try {
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
              logger.info(`Deleted local transcript file: ${filePath}`);
            }
          } catch (error) {
            logger.error(`Failed to delete transcript file ${filePath}:`, error);
          }
        }, 5000); // Wait 5 seconds to ensure upload is complete
      }
    } catch (error: any) {
      logger.error("Error exporting chat history:", error);
      await interaction.editReply({
        content: `❌ Failed to export chat history: ${error.message}`,
      });
    }
  },
};
