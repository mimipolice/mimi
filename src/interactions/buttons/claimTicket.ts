import { MessageFlags } from "discord-api-types/v10";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  Client,
  ComponentType,
  ContainerBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
  MessageActionRowComponentBuilder,
} from "discord.js";
import { Services } from "../../interfaces/Command";
import { createBusinessErrorReply } from "../../utils/interactionReply";
import { BusinessError } from "../../errors";
import logger from "../../utils/logger";
import { getInteractionLocale } from "../../utils/localeHelper";
import { TicketAction } from "../../types/ticket";
import { DiscordService } from "../../services/DiscordService";

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

      const originalMessage = interaction.message;

      // Build the action row with claim button disabled using localized labels
      const newRow = DiscordService.buildTicketActionRow(
        true,
        t("claimButton"),
        t("closeButton")
      );

      // For Components V2 messages, we need to rebuild components
      const existingComponents = originalMessage.components;

      if (existingComponents.length > 0) {
        /**
         * Components V2 mixes multiple component types (Container, ActionRow, Section, etc.)
         * Discord.js's type system doesn't have a unified base type for all V2 components.
         * We use a controlled union type with explicit handling for known component types.
         */
        const newComponents: (
          | ContainerBuilder
          | ActionRowBuilder<ButtonBuilder>
          | ActionRowBuilder<MessageActionRowComponentBuilder>
        )[] = [];

        for (const component of existingComponents) {
          if (component.type === ComponentType.ActionRow) {
            // Check if this row contains our buttons
            const hasClaimButton = component.components.some(
              (c) => c.type === ComponentType.Button && c.customId === TicketAction.CLAIM
            );
            if (hasClaimButton) {
              // Use the new row builder
              newComponents.push(newRow);
            } else {
              // Rebuild ActionRow from component data to maintain type consistency
              newComponents.push(
                ActionRowBuilder.from<MessageActionRowComponentBuilder>(component)
              );
            }
          } else if (component.type === ComponentType.Container) {
            // Rebuild container with "Claimed by" field added
            const containerData = component.toJSON();
            const newContainer = new ContainerBuilder(containerData);

            // Add separator and "Claimed by" text
            newContainer.addSeparatorComponents(
              new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
            );
            newContainer.addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `**${t("claimedByLabel")}**\n<@${interaction.user.id}>`
              )
            );

            newComponents.push(newContainer);
          }
          // Note: Other component types (Section, Separator, etc.) at top level
          // are not expected in ticket messages and are intentionally skipped
          // to maintain type safety. Add explicit handling if needed in the future.
        }

        try {
          await originalMessage.edit({
            components: newComponents,
            flags: MessageFlags.IsComponentsV2,
          });
        } catch (editError) {
          logger.warn("Failed to edit original message:", editError);
          // Notify user that edit failed but claim succeeded
          const channel = interaction.channel;
          if (channel?.isTextBased() && "send" in channel) {
            await channel.send({
              content: t("editFailed"),
            }).catch((sendError) => {
              logger.warn("Failed to send edit failure notification:", sendError);
            });
          }
        }
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
