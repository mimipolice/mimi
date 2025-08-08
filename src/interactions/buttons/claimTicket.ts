import { MessageFlags } from "discord-api-types/v10";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  EmbedBuilder,
  GuildMember,
  Client,
  ComponentType,
} from "discord.js";
import { Services } from "../../interfaces/Command"; // Import Services and Databases
import { createBusinessErrorReply } from "../../utils/interactionReply";
import { BusinessError } from "../../errors";

export default {
  name: "claim_ticket",
  // Correct the function signature
  execute: async function (
    interaction: ButtonInteraction,
    client: Client,
    services: Services
  ) {
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

      const locale = interaction.locale;
      const localizations = services.localizationManager.getLocale(
        "global",
        locale
      );
      const claimedMessage =
        localizations?.ticket?.claimed ||
        "You have successfully claimed this ticket.";

      return interaction.reply({
        content: claimedMessage,
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
      throw error;
    }
  },
};
