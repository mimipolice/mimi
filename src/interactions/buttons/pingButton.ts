import {
  ButtonInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  ContainerBuilder,
  SectionBuilder,
  ThumbnailBuilder,
} from "discord.js";
import { Button } from "../../interfaces/Button";
import { MessageFlags } from "discord-api-types/v10";

const button: Button = {
  name: "ping_button",
  execute: async (interaction: ButtonInteraction, client: Client) => {
    if (!client.user) return;
    const [, currentCountStr] = interaction.customId.split(":");
    const currentCount = parseInt(currentCountStr, 10);
    const newCount = currentCount + 1;

    const newRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`ping_button:${newCount}`)
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
                `延遲：\`${client.ws.ping}\` 毫秒！\n> 我被戳了 \`${newCount}\` 次`
              )
          )
          .setThumbnailAccessory(
            new ThumbnailBuilder().setURL(
              "https://cdn.discordapp.com/attachments/770976907797725205/1387330799086342325/10f266511a4de2896722814b5e54d3b6.gif"
            )
          )
      );

    await interaction.update({
      components: [container, newRow],
      flags: MessageFlags.IsComponentsV2,
    });
  },
};

export default button;
