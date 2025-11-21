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
    try {
      if (!client.user) return;
      
      // Check if interaction is still valid
      if (!interaction.isButton()) return;
      
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
    } catch (error: any) {
      // Silently ignore expired or already acknowledged interactions
      if (error.code === 10062 || error.code === 40060) {
        return;
      }
      throw error; // Re-throw other errors to be handled by the error handler
    }
  },
};

export default button;
