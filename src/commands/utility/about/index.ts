import {
  SlashCommandBuilder,
  CommandInteraction,
  Client,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} from "discord.js";
import { Command, Databases, Services } from "../../../interfaces/Command";
import credits from "../../../config/credits.json";

export default {
  data: new SlashCommandBuilder()
    .setName("about")
    .setDescription("About this bot, credits, and asset sources.")
    .setDescriptionLocalizations({
      "zh-TW": "關於此機器人、製作人員與素材來源。",
    }),

  async execute(
    interaction: CommandInteraction,
    _client: Client,
    _services: Services,
    _databases: Databases
  ) {
    if (!interaction.isChatInputCommand()) return;

    // Only defer if not already deferred or replied
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    const container = new ContainerBuilder().setAccentColor(0x5865f2);
    let hasContent = false;

    // Bot 資訊 - 只在有名稱或描述時顯示
    if (credits.bot.name || credits.bot.description) {
      const botInfo = [
        credits.bot.name ? `# ❀⋆｡ﾟ✧${credits.bot.name}✧｡ ⋆❀` : "# 🤖 Discord Bot",
        credits.bot.description || ""
      ].filter(Boolean).join("\n");
      
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(botInfo)
      );
      hasContent = true;
    }

    // 版本資訊 - 只在有版本號或依賴時顯示
    const validLibraries = credits.assets.libraries.filter(
      lib => lib.name && lib.version
    );
    
    if (credits.bot.version || validLibraries.length > 0) {
      if (hasContent) {
        container.addSeparatorComponents(new SeparatorBuilder());
      }
      
      const versionParts: string[] = ["## 📦 版本資訊"];
      
      if (credits.bot.version) {
        versionParts.push(`**Bot 版本：** ${credits.bot.version}`);
      }
      
      versionParts.push(`**Node.js：** ${process.version}`);
      
      if (validLibraries.length > 0) {
        const libraries = validLibraries
          .map((lib) => `• **${lib.name}** ${lib.version}`)
          .join("\n");
        versionParts.push("\n**主要依賴：**\n" + libraries);
      }
      
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(versionParts.join("\n"))
      );
      hasContent = true;
    }

    // 圖片素材來源 - 只在有有效項目時顯示
    const validImages = credits.assets.images.filter(
      img => img.name && img.source
    );
    
    if (validImages.length > 0) {
      if (hasContent) {
        container.addSeparatorComponents(new SeparatorBuilder());
      }
      
      const imageCredits = validImages
        .map((img) => `• **${img.name}**\n  來源: [${img.source}](${img.url})${img.license ? ` (${img.license})` : ""}`)
        .join("\n");

      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent("## 🎨 圖片素材\n" + imageCredits)
      );
      hasContent = true;
    }

    // 資料來源 - 只在有有效項目時顯示
    const validData = credits.assets.data.filter(
      data => data.name && data.source
    );
    
    if (validData.length > 0) {
      if (hasContent) {
        container.addSeparatorComponents(new SeparatorBuilder());
      }
      
      const dataCredits = validData
        .map((data) => `• **${data.name}**\n  來源: ${data.source}`)
        .join("\n");

      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent("## 📊 資料來源\n" + dataCredits)
      );
      hasContent = true;
    }

    // 開發團隊 - 只在有作者或貢獻者時顯示
    const validContributors = credits.contributors.filter(
      c => c.name && c.role
    );
    
    if (credits.bot.author || validContributors.length > 0) {
      if (hasContent) {
        container.addSeparatorComponents(new SeparatorBuilder());
      }
      
      const teamParts: string[] = ["## 👥 開發團隊"];
      
      if (credits.bot.author) {
        teamParts.push(`**作者：** ${credits.bot.author}`);
      }
      
      if (validContributors.length > 0) {
        const contributorsList = validContributors
          .map((c) => `• **${c.name}** - ${c.role}`)
          .join("\n");
        teamParts.push("\n**貢獻者：**\n" + contributorsList);
      }
      
      teamParts.push("\n感謝所有為此專案做出貢獻的人！");

      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(teamParts.join("\n"))
      );
      hasContent = true;
    }

    // 連結按鈕 - 只添加有效的 URL
    const buttons: ButtonBuilder[] = [];
    
    if (credits.links.github && credits.links.github.startsWith('http')) {
      buttons.push(
        new ButtonBuilder()
          .setLabel("GitHub")
          .setStyle(ButtonStyle.Link)
          .setURL(credits.links.github)
          .setEmoji("💻")
      );
    }
    
    if (credits.links.privacy && credits.links.privacy.startsWith('http')) {
      buttons.push(
        new ButtonBuilder()
          .setLabel("隱私政策")
          .setStyle(ButtonStyle.Link)
          .setURL(credits.links.privacy)
          .setEmoji("🔒")
      );
    }
    
    if (credits.links.terms && credits.links.terms.startsWith('http')) {
      buttons.push(
        new ButtonBuilder()
          .setLabel("服務條款")
          .setStyle(ButtonStyle.Link)
          .setURL(credits.links.terms)
          .setEmoji("📋")
      );
    }

        if (credits.links.support && credits.links.support.startsWith('https://discord.gg')) {
      buttons.push(
        new ButtonBuilder()
          .setLabel("支援伺服器")
          .setStyle(ButtonStyle.Link)
          .setURL(credits.links.support)
          .setEmoji("<:dc:1442109164624154664>")
      );
    }
    const components: any[] = [container];
    
    // 只在有按鈕時才添加 ActionRow
    if (buttons.length > 0) {
      const linkButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons);
      components.push(linkButtons);
    }

    await interaction.editReply({
      components: components,
      flags: [MessageFlags.IsComponentsV2],
    });
  },
} as Command;
