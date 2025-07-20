import {
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  MessageContextMenuCommandInteraction,
  Client,
  Locale,
} from "discord.js";
import { Command } from "../../../interfaces/Command";
import { getLocalizations } from "../../../utils/localization";

const translations = getLocalizations("messageinfo");

export const command: Command = {
  data: new ContextMenuCommandBuilder()
    .setName(translations["en-US"].name)
    .setNameLocalizations({
      [Locale.EnglishUS]: translations["en-US"].name,
      [Locale.ChineseTW]: translations["zh-TW"].name,
    })
    .setType(ApplicationCommandType.Message),
  async execute(
    interaction: MessageContextMenuCommandInteraction,
    client: Client
  ) {
    const t = translations[interaction.locale] ?? translations["en-US"];
    const targetMessage = interaction.targetMessage;

    await interaction.reply({
      content: `Message Info:\n- ID: ${targetMessage.id}\n- Content: ${targetMessage.content}`,
      ephemeral: true,
    });
  },
};
