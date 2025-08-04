// src/interactions/buttons/helpHandler.ts
import { ButtonInteraction, Client, GuildMember } from "discord.js";
import { buildHelpReply } from "../../commands/utility/help/helpRenderer";
import {
  getCommandsByCategory,
  getAccessibleCategories,
} from "../../commands/utility/help"; // Import helpers
import { Services } from "../../interfaces/Command";
import { Button } from "../../interfaces/Button";

const helpHandler: Button = {
  name: /^help:lang:/, // Specifically handle language buttons
  async execute(
    interaction: ButtonInteraction,
    client: Client,
    services: Services
  ) {
    await interaction.deferUpdate(); // **Acknowledge the API immediately**

    const parts = interaction.customId.split(":");
    const [_, action, lang, category, command] = parts;

    const newState = {
      lang: lang as any,
      category: category === "none" ? undefined : category,
      command: command === "none" ? undefined : command,
    };

    // --- Prepare Data ---
    const commandsByCategory = getCommandsByCategory(client);
    const accessibleCategories = getAccessibleCategories(
      client,
      interaction.member as GuildMember
    );
    const appCommands = await client.application!.commands.fetch();

    // --- Call Renderer ---
    const replyPayload = await buildHelpReply(
      newState,
      accessibleCategories,
      commandsByCategory,
      appCommands,
      services,
      interaction
    );

    await interaction.editReply(replyPayload);
  },
};

export default helpHandler;
