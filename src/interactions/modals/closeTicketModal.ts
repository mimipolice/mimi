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
    await ticketManager.close(interaction, reason);
    // The reply is handled within the close method, but we can add a final confirmation.
    await interaction.editReply({
      content: "Ticket has been successfully closed and archived.",
    });
  },
};
