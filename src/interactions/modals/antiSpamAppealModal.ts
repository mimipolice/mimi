import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalSubmitInteraction,
  TextChannel,
  MessageFlags,
} from "discord.js";
import { Modal } from "../../interfaces/Modal";
import { AntiSpamSettingsManager } from "../../services/AntiSpamSettingsManager";
import { mimiDLCDb } from "../../shared/database";
import { createUnauthorizedReply } from "../../utils/interactionReply";
import logger from "../../utils/logger";

const settingsManager = new AntiSpamSettingsManager(mimiDLCDb);

const modal: Modal = {
  name: "anti_spam_appeal_modal",
  execute: async (interaction: ModalSubmitInteraction) => {
    if (!interaction.isModalSubmit()) return;

    const { customId, client } = interaction;
    const [, userId, guildId, messageId] = customId.split(":");

    if (interaction.user.id !== userId) {
      await interaction.reply(createUnauthorizedReply(interaction));
      return;
    }

    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const appealReason = interaction.fields.getTextInputValue("appealReason");

      const user = await client.users.fetch(userId);
      if (!user.dmChannel) {
        await user.createDM();
      }
      const message = await user.dmChannel?.messages.fetch(messageId);

      if (!message) {
        throw new Error("Could not fetch the original DM message.");
      }

      const originalReason =
        message.content.split("**Reason**: ")[1]?.split("\n\n")[0] ??
        "Could not parse original reason.";

      const guild = await client.guilds.fetch(guildId);
      const member = await guild.members.fetch(userId);

      const settings = await settingsManager.getAntiSpamSettings(guildId);
      if (!settings?.log_channel_id) {
        logger.warn(
          `[Anti-Spam Appeal] No log channel configured for guild ${guildId}.`
        );
        await interaction.editReply({
          content:
            "Your appeal has been submitted, but the server administrators have not configured a channel to review it. Please contact them directly.",
        });
        return;
      }

      const logChannel = await client.channels.fetch(settings.log_channel_id);
      if (!logChannel || !(logChannel instanceof TextChannel)) {
        throw new Error("Could not find or access the log channel.");
      }

      const reviewEmbed = new EmbedBuilder()
        .setTitle("Timeout Appeal Review")
        .setColor("Yellow")
        .setAuthor({
          name: `${user.tag} (${user.id})`,
          iconURL: user.displayAvatarURL(),
        })
        .addFields(
          { name: "User", value: user.toString(), inline: true },
          {
            name: "Original Timeout Reason",
            value: originalReason,
            inline: false,
          },
          { name: "Appeal Reason", value: appealReason, inline: false }
        )
        .setTimestamp();

      if (member) {
        reviewEmbed.setThumbnail(member.displayAvatarURL());
      }

      const approveButton = new ButtonBuilder()
        .setCustomId(`appeal_approve:${userId}:${guildId}`)
        .setLabel("Approve")
        .setStyle(ButtonStyle.Success);

      const denyButton = new ButtonBuilder()
        .setCustomId(`appeal_deny:${userId}:${guildId}`)
        .setLabel("Deny")
        .setStyle(ButtonStyle.Danger);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        approveButton,
        denyButton
      );

      await logChannel.send({ embeds: [reviewEmbed], components: [row] });

      if (message) {
        await message.edit({
          content: message.content,
          embeds: message.embeds,
          components: [],
        });
      }

      await interaction.editReply({
        content: "Your appeal has been successfully submitted for review.",
      });
    } catch (error) {
      logger.error(
        `[Anti-Spam Appeal] Error handling appeal for user ${userId} in guild ${guildId}:`,
        error
      );
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({
          content:
            "An error occurred while submitting your appeal. Please try again later.",
        });
      } else {
        await interaction.reply({
          content:
            "An error occurred while submitting your appeal. Please try again later.",
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  },
};

export default modal;
