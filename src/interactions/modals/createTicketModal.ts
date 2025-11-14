import { ModalSubmitInteraction } from "discord.js";
import { Services } from "../../interfaces/Command";
import { MessageFlags } from "discord-api-types/v10";
import logger from "../../utils/logger";

export default {
  name: "create_ticket_modal",
  execute: async (interaction: ModalSubmitInteraction, services: Services) => {
    if (!services.ticketManager) {
      logger.error("TicketManager service not available in createTicketModal");
      return;
    }

    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const [_, ticketType] = interaction.customId.split(":");
      const issueDescription = interaction.fields.getTextInputValue(
        "ticket_issue_description"
      );

      // Validate description length (Discord embed field limit is 1024)
      if (issueDescription.length > 1024) {
        logger.warn(
          `User ${interaction.user.id} attempted to create ticket with description length ${issueDescription.length} (max 1024)`
        );
        await interaction.editReply({
          content: `❌ Issue description is too long (${issueDescription.length} characters). Please keep it under 1024 characters.`,
        });
        return;
      }

      await services.ticketManager.create(
        interaction,
        issueDescription,
        ticketType
      );
    } catch (error: any) {
      logger.error("Error in createTicketModal:", {
        error: error.message,
        stack: error.stack,
        userId: interaction.user.id,
        guildId: interaction.guildId,
      });

      // Try to inform the user
      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({
            content: "❌ An error occurred while creating your ticket. Please try again or contact an administrator.",
          });
        } else {
          await interaction.reply({
            content: "❌ An error occurred while creating your ticket. Please try again or contact an administrator.",
            flags: MessageFlags.Ephemeral,
          });
        }
      } catch (replyError) {
        logger.error("Failed to send error message to user:", replyError);
      }
    }
  },
};
