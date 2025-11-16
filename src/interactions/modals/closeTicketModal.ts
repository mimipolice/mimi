import { MessageFlags } from "discord-api-types/v10";
import { ModalSubmitInteraction, TextChannel, ActionRowBuilder, ButtonBuilder } from "discord.js";
import { Services } from "../../interfaces/Command"; // Import the Services interface
import logger from "../../utils/logger";

export default {
  name: "close_ticket_modal",
  // The execute function should accept the 'services' object
  execute: async function (
    interaction: ModalSubmitInteraction,
    services: Services
  ) {
    const { ticketManager } = services; // Destructure ticketManager from services
    const reason = interaction.fields.getTextInputValue("close_reason");
    await interaction.deferReply(); // Defer with ephemeral
    
    // Try to find and remove the close request message with button
    try {
      const channel = interaction.channel as TextChannel;
      if (channel) {
        const messages = await channel.messages.fetch({ limit: 20 });
        const closeRequestMessage = messages.find(
          msg => {
            if (msg.components.length === 0) return false;
            const row = msg.components[0];
            if (!('components' in row)) return false;
            return row.components.some((comp: any) =>
              comp.customId?.startsWith('confirm_close_request')
            );
          }
        );
        
        if (closeRequestMessage) {
          await closeRequestMessage.edit({ components: [] });
        }
      }
    } catch (error) {
      logger.warn('Failed to remove close request button:', error);
      // Continue even if this fails
    }
    
    // The close method handles the reply internally
    await ticketManager.close(interaction, reason);
  },
};
