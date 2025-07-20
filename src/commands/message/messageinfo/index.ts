import {
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  MessageContextMenuCommandInteraction,
  Locale,
} from "discord.js";
import { Command } from "../../../interfaces/Command";
import { getLocalizations } from "../../../utils/localization";
import { MessageFlags } from "discord-api-types/v10";

const translations = getLocalizations("messageinfo");

export const command: Command = {
  data: new ContextMenuCommandBuilder()
    .setName(translations["en-US"].name)
    .setNameLocalizations({
      [Locale.EnglishUS]: translations["en-US"].name,
      [Locale.ChineseTW]: translations["zh-TW"].name,
    })
    .setType(ApplicationCommandType.Message),
  async execute(interaction: MessageContextMenuCommandInteraction) {
    const t = translations[interaction.locale] ?? translations["en-US"];
    const targetMessage = interaction.targetMessage;

    await interaction.reply({
      content: `${t.messageInfo.id}: ${targetMessage.id}\n${t.messageInfo.content}: ${targetMessage.content}`,
      flags: MessageFlags.Ephemeral,
    });
  },
};
