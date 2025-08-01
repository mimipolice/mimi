import {
  ButtonInteraction,
  PermissionFlagsBits,
  ButtonBuilder,
} from "discord.js";
import { mimiDLCDb } from "../../shared/database";
import { MessageFlags } from "discord-api-types/v10";
import logger from "../../utils/logger";

export default {
  name: "confirm_purge:",
  execute: async function (interaction: ButtonInteraction) {
    await interaction.deferUpdate();

    const parts = interaction.customId.split(":");
    const originalUserId = parts[1];

    if (interaction.user.id !== originalUserId) {
      await interaction.followUp({
        content: "Only the user who initiated the purge can confirm it.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (
      !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
    ) {
      await interaction.followUp({
        content: "You no longer have permission to do this.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    try {
      await mimiDLCDb.transaction().execute(async (trx) => {
        await trx
          .deleteFrom("tickets")
          .where("guildId", "=", interaction.guildId!)
          .execute();
        await trx
          .updateTable("guild_ticket_counters")
          .set({ lastTicketId: 0 })
          .where("guildId", "=", interaction.guildId!)
          .execute();
      });

      const disabledButton = ButtonBuilder.from(
        interaction.component
      ).setDisabled(true);
      await interaction.editReply({
        content:
          "✅ All ticket records have been permanently deleted and the ID counter has been reset.",
        components: [{ type: 1, components: [disabledButton] }],
      });
    } catch (error) {
      logger.error("Failed to purge tickets:", error);
      await interaction.editReply({
        content:
          "An error occurred while trying to purge the tickets. Please check the logs.",
        components: [],
      });
    }
  },
};
