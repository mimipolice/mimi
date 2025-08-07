import { MessageFlags } from "discord-api-types/v10";
import { SlashCommandBuilder, GuildMember } from "discord.js";
import { Command } from "../../../interfaces/Command";
import { buildHelpEmbed, HelpState } from "./helpEmbedBuilder";

export default {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Shows a list of available commands."),
  execute: async (interaction, client, services) => {
    await interaction.deferReply();
    const { helpService } = services;
    const member =
      interaction.member instanceof GuildMember ? interaction.member : null;
    // Set initial state for the help menu, detecting user's locale
    const initialState: HelpState = {
      lang: interaction.locale.startsWith("zh") ? "zh-TW" : "en-US",
      view: "home",
    };
    const payload = await buildHelpEmbed(
      initialState,
      helpService,
      member,
      services
    );
    await interaction.editReply({
      components: [payload.container, ...payload.components],
      files: payload.files,
      flags: MessageFlags.IsComponentsV2,
    });
  },
} as Command;
