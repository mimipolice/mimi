import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  Client,
  ContainerBuilder,
  MessageFlags,
  SectionBuilder,
  ThumbnailBuilder,
} from "discord.js";
import { Command } from "../../../interfaces/Command";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Replies with pong!"),
  detailedHelpPath: "src/commands/help_docs/public/ping.md",
  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const initialCount = 0;

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`ping_button:${initialCount}`)
        .setLabel("重新測試")
        .setStyle(ButtonStyle.Success)
    );

    const container = new ContainerBuilder()
      .setAccentColor(0xefafef)
      .addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(
            (textDisplay) => textDisplay.setContent("🏓 **pong！**"),
            (textDisplay) =>
              textDisplay.setContent(
                `延遲：\`${client.ws.ping}\` 毫秒！\n> 我被戳了 \`${initialCount}\` 次`
              )
          )
          .setThumbnailAccessory(
            new ThumbnailBuilder().setURL(
              "https://cdn.discordapp.com/attachments/770976907797725205/1387330799086342325/10f266511a4de2896722814b5e54d3b6.gif"
            )
          )
      );

    await interaction.reply({
      components: [container, row],
      flags: MessageFlags.IsComponentsV2,
    });
  },
};
