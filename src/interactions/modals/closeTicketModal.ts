import { MessageFlags } from "discord-api-types/v10";
import { ModalSubmitInteraction } from "discord.js";
import { Services } from "../../interfaces/Command"; // Import the Services interface

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
    
    // The close method handles the reply internally
    await ticketManager.close(interaction, reason);
  },
};
