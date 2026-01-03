import { ModalSubmitInteraction } from "discord.js";
import { Services } from "../../interfaces/Command";
import { MessageFlags } from "discord-api-types/v10";
import logger from "../../utils/logger";
import { getInteractionLocale } from "../../utils/localeHelper";

export default {
  name: "create_ticket_modal",
  execute: async (interaction: ModalSubmitInteraction, services: Services) => {
    const locale = getInteractionLocale(interaction);
    const { localizationManager } = services;

    const t = (key: string, options?: Record<string, string | number>) =>
      localizationManager.get(`global.ticket.${key}`, locale, options) ?? key;

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
          content: t("descriptionTooLong", { length: issueDescription.length }),
        });
        return;
      }

      await services.ticketManager.create(
        interaction,
        issueDescription,
        ticketType
      );
    } catch (error: unknown) {
      const err = error as { message?: string; stack?: string; code?: number };
      logger.error("Error in createTicketModal:", {
        error: err.message,
        stack: err.stack,
        userId: interaction.user.id,
        guildId: interaction.guildId,
      });

      // Don't try to reply if the interaction token is invalid (expired/unknown)
      if (err.code === 10062) {
        // Unknown interaction - token expired, nothing we can do
        return;
      }

      // Try to inform the user
      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({
            content: t("createError"),
          });
        } else {
          await interaction.reply({
            content: t("createError"),
            flags: MessageFlags.Ephemeral,
          });
        }
      } catch (replyError) {
        // Silently ignore if we can't reply (interaction probably expired)
        const replyErr = replyError as { code?: number };
        if (replyErr.code !== 10062 && replyErr.code !== 40060) {
          logger.error("Failed to send error message to user:", replyError);
        }
      }
    }
  },
};
