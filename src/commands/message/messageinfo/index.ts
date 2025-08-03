import {
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  MessageContextMenuCommandInteraction,
  Locale,
} from "discord.js";
import { Command, Services } from "../../../interfaces/Command";
import { getLocalizations } from "../../../utils/localization";
import { MessageFlags } from "discord-api-types/v10";

export const command: Command = {
  data: new ContextMenuCommandBuilder()
    .setName("messageinfo")
    .setNameLocalizations({
      [Locale.EnglishUS]: "messageinfo",
      [Locale.ChineseTW]: "訊息資訊",
    })
    .setType(ApplicationCommandType.Message),
  async execute(
    interaction: MessageContextMenuCommandInteraction,
    client,
    { localizationManager }: Services
  ) {
    const translations = getLocalizations(localizationManager, "messageinfo");
    const t = translations[interaction.locale] ?? translations["en-US"];
    const targetMessage = interaction.targetMessage;

    await interaction.reply({
      content: `${t.messageInfo.id}: ${targetMessage.id}\n${t.messageInfo.content}: ${targetMessage.content}`,
      flags: MessageFlags.Ephemeral,
    });
  },
};
