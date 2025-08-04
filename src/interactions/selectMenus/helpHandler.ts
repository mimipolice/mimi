// src/interactions/selectMenus/helpHandler.ts
import { StringSelectMenuInteraction, Client, GuildMember } from "discord.js";
import { buildHelpReply } from "../../commands/utility/help/helpRenderer";
import {
  getCommandsByCategory,
  getAccessibleCategories,
} from "../../commands/utility/help";
import { Databases, Services } from "../../interfaces/Command";
import { SelectMenu } from "../../interfaces/SelectMenu";

const helpHandler: SelectMenu = {
  name: /^help:(category|command):/, // Match both category and command menus
  async execute(
    interaction: StringSelectMenuInteraction,
    services: Services,
    databases: Databases
  ) {
    const { client } = interaction;
    await interaction.deferUpdate();

    const parts = interaction.customId.split(":");
    const [_, action, lang, categoryFromId] = parts;
    const selectedValue = interaction.values[0];

    let newState;

    if (action === "category") {
      newState = {
        lang: lang as any,
        category: selectedValue,
        command: undefined, // Reset command when category changes
      };
    } else if (action === "command") {
      newState = {
        lang: lang as any,
        category: categoryFromId,
        command: selectedValue,
      };
    } else {
      return; // Should not happen with the regex
    }

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
