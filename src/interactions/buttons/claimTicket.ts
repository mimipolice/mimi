import { MessageFlags } from "discord-api-types/v10";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  EmbedBuilder,
  Client,
  ComponentType,
} from "discord.js";
import { Services } from "../../interfaces/Command";
import { createBusinessErrorReply } from "../../utils/interactionReply";
import { BusinessError } from "../../errors";
import logger from "../../utils/logger";
import { getInteractionLocale } from "../../utils/localeHelper";

export default {
  name: "claim_ticket",
  execute: async function (
    interaction: ButtonInteraction,
    client: Client,
    services: Services
  ) {
    const locale = getInteractionLocale(interaction);
    const { localizationManager } = services;

    const t = (key: string) =>
      localizationManager.get(`global.ticket.${key}`, locale) ?? key;

    try {
      await services.ticketManager.claim(interaction);

      const originalMessage = await interaction.channel?.messages.fetch(
        interaction.message.id
      );
      if (originalMessage && originalMessage.embeds.length > 0) {
        const updatedEmbed = new EmbedBuilder(
          originalMessage.embeds[0].toJSON()
        ).addFields({ name: "Claimed by", value: `<@${interaction.user.id}>` });

        // Disable the 'Claim' button after it's been claimed
        const newComponents: ActionRowBuilder<ButtonBuilder>[] = [];
        for (const row of originalMessage.components) {
          if (row.type === ComponentType.ActionRow) {
            const newRow = new ActionRowBuilder<ButtonBuilder>();
            for (const component of row.components) {
              if (component.type === ComponentType.Button) {
                const button = ButtonBuilder.from(component);
                if (component.customId === "claim_ticket") {
                  button.setDisabled(true);
                }
                newRow.addComponents(button);
              }
            }
            newComponents.push(newRow);
          }
        }

        await originalMessage.edit({
          embeds: [updatedEmbed],
          components: newComponents,
        });
      }

      return interaction.reply({
        content: t("claimed"),
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      if (error instanceof BusinessError) {
        return interaction.reply(
          createBusinessErrorReply(
            services.localizationManager,
            interaction,
            error.message
          )
        );
      }

      logger.error("Error in claimTicket:", {
        error,
        userId: interaction.user.id,
        guildId: interaction.guildId,
        channelId: interaction.channelId,
      });

      // Try to inform the user
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: t("claimError"),
            flags: MessageFlags.Ephemeral,
          });
        }
      } catch (replyError) {
        logger.error("Failed to send error message in claimTicket:", replyError);
      }
    }
  },
};
