import {
  ButtonInteraction,
  PermissionFlagsBits,
  ButtonBuilder,
  Client,
} from "discord.js";
import { MessageFlags } from "discord-api-types/v10";
import logger from "../../utils/logger";
import { createUnauthorizedReply } from "../../utils/interactionReply";
import { Services } from "../../interfaces/Command";
import { MissingPermissionsError } from "../../errors";

export default {
  name: "confirm_purge:",
  execute: async function (
    interaction: ButtonInteraction,
    client: Client,
    services: Services
  ) {
    await interaction.deferUpdate();

    const parts = interaction.customId.split(":");
    const originalUserId = parts[1];

    if (interaction.user.id !== originalUserId) {
      await interaction.followUp(
        createUnauthorizedReply(services.localizationManager, interaction)
      );
      return;
    }

    if (
      !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
    ) {
      throw new MissingPermissionsError(
        "You no longer have permission to do this."
      );
    }

    try {
      const { ticketManager } = services;
      await ticketManager.purge(interaction.guildId!);

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
