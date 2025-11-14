import {
  ButtonInteraction,
  Client,
  EmbedBuilder,
  MessageFlags,
} from "discord.js";
import { Button } from "../../interfaces/Button";
import logger from "../../utils/logger";

const appealReviewButton: Button = {
  name: /^(appeal_approve|appeal_deny):(\d+):(\d+)$/,
  execute: async (interaction: ButtonInteraction, client: Client) => {
    const [action, userId, guildId] = interaction.customId.split(":");

    const guild = await client.guilds.fetch(guildId);
    if (!guild) {
      await interaction.reply({
        content: "Guild not found.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) {
      await interaction.reply({
        content: "Member not found in this guild.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const originalEmbed = interaction.message.embeds[0];
    const newEmbed = new EmbedBuilder(originalEmbed.toJSON());

    if (action === "appeal_approve") {
      try {
        await member.timeout(null, "Appeal approved by administrator.");
        await member
          .send(
            "Your appeal has been approved, and your timeout has been removed."
          )
          .catch(() => {
            logger.warn(`Could not DM user ${userId} for appeal approval`);
          });
        newEmbed.setTitle("Appeal Approved").setColor("Green").addFields({
          name: "Moderator",
          value: interaction.user.toString(),
          inline: true,
        });
      } catch (error) {
        logger.error("Failed to approve appeal:", {
          error,
          userId,
          guildId,
          moderator: interaction.user.id,
        });
        await interaction.reply({
          content: "Failed to remove timeout.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
    } else if (action === "appeal_deny") {
      try {
        await member.send("Your appeal has been denied.").catch(() => {
          logger.warn(`Could not DM user ${userId} for appeal denial`);
        });
        newEmbed.setTitle("Appeal Denied").setColor("Red").addFields({
          name: "Moderator",
          value: interaction.user.toString(),
          inline: true,
        });
      } catch (error) {
        logger.error("Failed to deny appeal:", {
          error,
          userId,
          guildId,
          moderator: interaction.user.id,
        });
      }
    }

    await interaction.message.edit({ embeds: [newEmbed], components: [] });
    await interaction.reply({
      content: `The appeal has been ${
        action === "appeal_approve" ? "approved" : "denied"
      }.`,
      flags: MessageFlags.Ephemeral,
    });
  },
};

export default appealReviewButton;
