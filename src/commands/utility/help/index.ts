import {
  ChatInputCommandInteraction,
  Client,
  SlashCommandBuilder,
} from "discord.js";
import { Command, Services } from "../../../interfaces/Command";
import { buildHelpReply } from "./helpRenderer";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Displays a list of available commands."),
  async execute(
    interaction: ChatInputCommandInteraction,
    client: Client,
    services: Services
  ) {
    // Initial state
    const initialState = { lang: "zh-TW" as const };
    const replyPayload = await buildHelpReply(
      initialState,
      client,
      services,
      interaction
    );
    await interaction.reply(replyPayload);
  },
};
