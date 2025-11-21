import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  TextDisplayBuilder,
  MessageFlags,
} from "discord.js";
import { Command } from "../../../interfaces/Command";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("test-error")
    .setDescription("測試錯誤訊息顯示 (Components v2)")
    .setDefaultMemberPermissions(0)
    .setDMPermission(false),

  async execute(
    interaction: ChatInputCommandInteraction,
    client: Client,
    services: any
  ) {
    const container = new ContainerBuilder()
      .setAccentColor(0x5865f2)
      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent("# 🧪 錯誤訊息測試面板\n\n點擊下方按鈕測試不同類型的錯誤訊息顯示效果：")
      );

    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("test_error:business")
        .setLabel("業務邏輯錯誤")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("test_error:internal")
        .setLabel("內部錯誤")
        .setStyle(ButtonStyle.Danger)
    );

    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("test_error:cooldown")
        .setLabel("冷卻時間")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("test_error:permissions")
        .setLabel("權限不足")
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({
      components: [container, row1, row2],
      flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
    });
  },
};

export default command;
