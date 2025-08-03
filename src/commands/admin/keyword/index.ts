import {
  SlashCommandBuilder,
  CommandInteraction,
  AutocompleteInteraction,
  PermissionFlagsBits,
  Locale,
  Client,
} from "discord.js";
import { mimiDLCDb } from "../../../shared/database";
import {
  addKeyword,
  removeKeyword,
  getKeywordsByGuild,
} from "../../../shared/database/queries";
import { flushKeywordsCacheForGuild } from "../../../shared/cache";
import { MessageFlags } from "discord-api-types/v10";
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
      if (subcommand === "list") {
        await interaction.deferReply();
      } else {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      }

      if (subcommand === "add") {
        const type = interaction.options.getString(
          t.subcommands.add.options.type.name,
          true
        ) as "exact" | "contains";
        const keyword = interaction.options.getString(
          t.subcommands.add.options.keyword.name,
          true
        );
        const reply = interaction.options.getString(
          t.subcommands.add.options.reply.name,
          true
        );

        await addKeyword(mimiDLCDb, interaction.guildId, keyword, reply, type);
        flushKeywordsCacheForGuild(interaction.guildId);
        await interaction.editReply(
          t.subcommands.add.responses.success.replace("{{keyword}}", keyword)
        );
      } else if (subcommand === "remove") {
        const keyword = interaction.options.getString(
          t.subcommands.remove.options.keyword.name,
          true
        );
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
        const list = keywords
          .map((kw) =>
            t.subcommands.list.responses.list_item
              .replace("{{keyword}}", kw.keyword)
              .replace("{{match_type}}", kw.match_type)
              .replace("{{reply}}", kw.reply)
          )
          .join("\n\n");
        await interaction.editReply(
          `${t.subcommands.list.responses.title}\n\n${list}`
        );
      }
    } catch (error) {
      logger.error("Keyword command error:", error);
      await interaction.editReply(t.general_error);
    }
  },
};
