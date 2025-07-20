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
  Locale,
  ComponentType,
} from "discord.js";
import { Command } from "../../../interfaces/Command";
import { getLocalizations } from "../../../utils/localization";

const translations = getLocalizations("ping");

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName(translations["en-US"].name)
    .setDescription(translations["en-US"].description)
    .setNameLocalizations({
      [Locale.EnglishUS]: translations["en-US"].name,
      [Locale.ChineseTW]: translations["zh-TW"].name,
    })
    .setDescriptionLocalizations({
      [Locale.EnglishUS]: translations["en-US"].description,
      [Locale.ChineseTW]: translations["zh-TW"].description,
    }),
  detailedHelpPath: "src/commands/help_docs/public/ping.md",
  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const t = translations[interaction.locale] ?? translations["en-US"];
    let count = 0;

    const buildContainer = (latency: number, pokeCount: number) => {
      return new ContainerBuilder()
        .setAccentColor(0xefafef)
        .addSectionComponents(
          new SectionBuilder()
            .addTextDisplayComponents(
              (textDisplay) => textDisplay.setContent(t.responses.pong),
              (textDisplay) =>
                textDisplay.setContent(
                  t.responses.latency
                    .replace("{{latency}}", latency.toString())
                    .replace("{{count}}", pokeCount.toString())
                )
            )
            .setThumbnailAccessory(
              new ThumbnailBuilder().setURL(
                "https://cdn.discordapp.com/attachments/770976907797725205/1387330799086342325/10f266511a4de2896722814b5e54d3b6.gif"
              )
            )
        );
    };

    const buildRow = () => {
      return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("ping_button")
          .setLabel(t.responses.button_label)
          .setStyle(ButtonStyle.Success)
      );
    };

    const reply = await interaction.reply({
      components: [buildContainer(client.ws.ping, count), buildRow()],
      flags: MessageFlags.IsComponentsV2,
      fetchReply: true,
    });

    const collector = reply.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60000, // 1 minute
    });

    collector.on("collect", async (i) => {
      if (i.customId === "ping_button") {
        count++;
        await i.update({
          components: [buildContainer(client.ws.ping, count), buildRow()],
          flags: MessageFlags.IsComponentsV2,
        });
      }
    });

    collector.on("end", async () => {
      try {
        const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          ButtonBuilder.from(buildRow().components[0]).setDisabled(true)
        );
        await interaction.editReply({
          components: [buildContainer(client.ws.ping, count), disabledRow],
        });
      } catch (error) {
        // Ignore errors if the message was deleted
      }
    });
  },
};
