import {
  SlashCommandBuilder,
  CommandInteraction,
  AutocompleteInteraction,
  PermissionFlagsBits,
  Locale,
  Client,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  MessageFlags,
} from "discord.js";
import { mimiDLCDb } from "../../../shared/database";
import {
  addKeyword,
  removeKeyword,
  getKeywordsByGuild,
} from "../../../repositories/admin.repository";
import { flushKeywordsCacheForGuild } from "../../../shared/cache";
import { getLocalizations } from "../../../utils/localization";
import logger from "../../../utils/logger";
import { Command, Databases, Services } from "../../../interfaces/Command";

export default {
  data: new SlashCommandBuilder()
    .setName("keyword")
    .setDescription("Manage keyword replies.")
    .setNameLocalizations({
      [Locale.ChineseTW]: "關鍵字",
    })
    .setDescriptionLocalizations({
      [Locale.ChineseTW]: "管理關鍵字回覆。",
    })
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("add")
        .setDescription("Add a keyword reply.")
        .setNameLocalizations({
          [Locale.ChineseTW]: "新增",
        })
        .setDescriptionLocalizations({
          [Locale.ChineseTW]: "新增關鍵字回覆。",
        })
        .addStringOption((option) =>
          option
            .setName("type")
            .setDescription("The type of match.")
            .setNameLocalizations({
              [Locale.ChineseTW]: "類型",
            })
            .setDescriptionLocalizations({
              [Locale.ChineseTW]: "比對類型。",
            })
            .setRequired(true)
            .addChoices(
              {
                name: "Exact",
                value: "exact",
                name_localizations: {
                  [Locale.ChineseTW]: "完全符合",
                },
              },
              {
                name: "Contains",
                value: "contains",
                name_localizations: {
                  [Locale.ChineseTW]: "包含",
                },
              }
            )
        )
        .addStringOption((option) =>
          option
            .setName("keyword")
            .setDescription("The keyword to match.")
            .setNameLocalizations({
              [Locale.ChineseTW]: "關鍵字",
            })
            .setDescriptionLocalizations({
              [Locale.ChineseTW]: "要比對的關鍵字。",
            })
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addStringOption((option) =>
          option
            .setName("reply")
            .setDescription("The reply message.")
            .setNameLocalizations({
              [Locale.ChineseTW]: "回覆",
            })
            .setDescriptionLocalizations({
              [Locale.ChineseTW]: "回覆的訊息。",
            })
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("remove")
        .setDescription("Remove a keyword reply.")
        .setNameLocalizations({
          [Locale.ChineseTW]: "移除",
        })
        .setDescriptionLocalizations({
          [Locale.ChineseTW]: "移除關鍵字回覆。",
        })
        .addStringOption((option) =>
          option
            .setName("keyword")
            .setDescription("The keyword to remove.")
            .setNameLocalizations({
              [Locale.ChineseTW]: "關鍵字",
            })
            .setDescriptionLocalizations({
              [Locale.ChineseTW]: "要移除的關鍵字。",
            })
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("list")
        .setDescription("List all keyword replies.")
        .setNameLocalizations({
          [Locale.ChineseTW]: "列表",
        })
        .setDescriptionLocalizations({
          [Locale.ChineseTW]: "列出所有關鍵字回覆。",
        })
    ),

  async autocomplete(interaction: AutocompleteInteraction) {
    if (!interaction.guildId) return;
    const focusedValue = interaction.options.getFocused();
    const keywords = await getKeywordsByGuild(mimiDLCDb, interaction.guildId);
    const choices = keywords
      .filter((kw) => kw.keyword.startsWith(focusedValue))
      .map((kw) => ({ name: kw.keyword, value: kw.keyword }));
    await interaction.respond(choices.slice(0, 25));
  },

  async execute(
    interaction: CommandInteraction,
    _client: Client,
    { localizationManager }: Services,
    { ticketDb: mimiDLCDb }: Databases
  ) {
    if (!interaction.isChatInputCommand() || !interaction.guildId) return;

    const translations = getLocalizations(localizationManager, "keyword");
    const t = translations[interaction.locale] || translations["en-US"];
    const subcommand = interaction.options.getSubcommand();

    try {
      // Only defer if not already deferred or replied
      if (!interaction.deferred && !interaction.replied) {
        if (subcommand === "list") {
          await interaction.deferReply();
        } else {
          await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        }
      }

      if (subcommand === "add") {
        // Use English option names (as defined in SlashCommandBuilder), not localized names
        const type = interaction.options.getString("type", true) as "exact" | "contains";
        const keyword = interaction.options.getString("keyword", true);
        const reply = interaction.options.getString("reply", true);

        await addKeyword(mimiDLCDb, interaction.guildId, keyword, reply, type);
        flushKeywordsCacheForGuild(interaction.guildId);
        await interaction.editReply(
          t.subcommands.add.responses.success.replace("{{keyword}}", keyword)
        );
      } else if (subcommand === "remove") {
        // Use English option name
        const keyword = interaction.options.getString("keyword", true);
        await removeKeyword(mimiDLCDb, interaction.guildId, keyword);
        flushKeywordsCacheForGuild(interaction.guildId);
        await interaction.editReply(
          t.subcommands.remove.responses.success.replace("{{keyword}}", keyword)
        );
      } else if (subcommand === "list") {
        const keywords = await getKeywordsByGuild(
          mimiDLCDb,
          interaction.guildId
        );
        if (keywords.length === 0) {
          await interaction.editReply(t.subcommands.list.responses.no_keywords);
          return;
        }

        // Build Components v2 with Container to prevent mentions
        const container = new ContainerBuilder()
          .setAccentColor(0xFAA7CF); // #FAA7CF
        
        // Header with summary
        container.addTextDisplayComponents(
          new TextDisplayBuilder()
            .setContent(`# ${t.subcommands.list.responses.title}\n*Total: ${keywords.length} keyword(s)*`)
        );
        
        // Add separator
        container.addSeparatorComponents(new SeparatorBuilder());
        
        // Group keywords by type for better organization
        const exactKeywords = keywords.filter(kw => kw.match_type === 'exact');
        const containsKeywords = keywords.filter(kw => kw.match_type === 'contains');
        
        // Helper function to create keyword sections with character limit
        const addKeywordSections = (keywordList: typeof keywords, typeLabel: string) => {
          if (keywordList.length === 0) return;
          
          // Type header
          container.addTextDisplayComponents(
            new TextDisplayBuilder()
              .setContent(`## ${typeLabel} (${keywordList.length})`)
          );
          
          // Split into chunks to avoid character limit (max ~700 chars per TextDisplay)
          const CHUNK_SIZE = 4;
          for (let i = 0; i < keywordList.length; i += CHUNK_SIZE) {
            const chunk = keywordList.slice(i, i + CHUNK_SIZE);
            const content = chunk
              .map((kw, idx) => {
                const num = i + idx + 1;
                // Truncate long replies to prevent overflow
                const reply = kw.reply.length > 80 
                  ? kw.reply.substring(0, 77) + '...' 
                  : kw.reply;
                return `**${num}.** \`${kw.keyword}\`\n↳ ${reply}`;
              })
              .join('\n\n');
            
            container.addTextDisplayComponents(
              new TextDisplayBuilder().setContent(content)
            );
            
            // Add separator between chunks (but not after the last one)
            if (i + CHUNK_SIZE < keywordList.length) {
              container.addSeparatorComponents(new SeparatorBuilder());
            }
          }
        };
        
        // Add exact match keywords
        if (exactKeywords.length > 0) {
          addKeywordSections(exactKeywords, '🎯 Exact Match');
          if (containsKeywords.length > 0) {
            container.addSeparatorComponents(new SeparatorBuilder());
          }
        }
        
        // Add contains keywords
        if (containsKeywords.length > 0) {
          addKeywordSections(containsKeywords, '🔍 Contains');
        }
        
        await interaction.editReply({
          content: null,
          embeds: [],
          components: [container],
          flags: [MessageFlags.IsComponentsV2],
          allowedMentions: { parse: [] } // 禁止所有 mentions
        });
      }
    } catch (error) {
      logger.error(`Keyword command error (by <@${interaction.user.id}> / ${interaction.user.id}):`, error);
      await interaction.editReply(t.general_error);
    }
  },
};
