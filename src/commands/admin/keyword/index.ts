import {
  SlashCommandBuilder,
  CommandInteraction,
  AutocompleteInteraction,
  PermissionFlagsBits,
  Locale,
} from "discord.js";
import { ticketPool } from "../../../shared/database";
import {
  addKeyword,
  removeKeyword,
  getKeywordsByGuild,
} from "../../../shared/database/queries";
import { flushKeywordsCache } from "../../../shared/cache";
import { MessageFlags } from "discord-api-types/v10";
import { getLocalizations } from "../../../utils/localization";
import logger from "../../../utils/logger";

const translations = getLocalizations("keyword");

export default {
  data: new SlashCommandBuilder()
    .setName(translations["en-US"].name)
    .setDescription(translations["en-US"].description)
    .setNameLocalizations({
      [Locale.ChineseTW]: translations["zh-TW"].name,
    })
    .setDescriptionLocalizations({
      [Locale.ChineseTW]: translations["zh-TW"].description,
    })
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((subcommand) =>
      subcommand
        .setName(translations["en-US"].subcommands.add.name)
        .setDescription(translations["en-US"].subcommands.add.description)
        .setNameLocalizations({
          [Locale.ChineseTW]: translations["zh-TW"].subcommands.add.name,
        })
        .setDescriptionLocalizations({
          [Locale.ChineseTW]: translations["zh-TW"].subcommands.add.description,
        })
        .addStringOption((option) =>
          option
            .setName(translations["en-US"].subcommands.add.options.type.name)
            .setDescription(
              translations["en-US"].subcommands.add.options.type.description
            )
            .setNameLocalizations({
              [Locale.ChineseTW]:
                translations["zh-TW"].subcommands.add.options.type.name,
            })
            .setDescriptionLocalizations({
              [Locale.ChineseTW]:
                translations["zh-TW"].subcommands.add.options.type.description,
            })
            .setRequired(true)
            .addChoices(
              {
                name: translations["en-US"].subcommands.add.options.type.choices
                  .exact,
                value: "exact",
                name_localizations: {
                  [Locale.ChineseTW]:
                    translations["zh-TW"].subcommands.add.options.type.choices
                      .exact,
                },
              },
              {
                name: translations["en-US"].subcommands.add.options.type.choices
                  .contains,
                value: "contains",
                name_localizations: {
                  [Locale.ChineseTW]:
                    translations["zh-TW"].subcommands.add.options.type.choices
                      .contains,
                },
              }
            )
        )
        .addStringOption((option) =>
          option
            .setName(translations["en-US"].subcommands.add.options.keyword.name)
            .setDescription(
              translations["en-US"].subcommands.add.options.keyword.description
            )
            .setNameLocalizations({
              [Locale.ChineseTW]:
                translations["zh-TW"].subcommands.add.options.keyword.name,
            })
            .setDescriptionLocalizations({
              [Locale.ChineseTW]:
                translations["zh-TW"].subcommands.add.options.keyword
                  .description,
            })
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addStringOption((option) =>
          option
            .setName(translations["en-US"].subcommands.add.options.reply.name)
            .setDescription(
              translations["en-US"].subcommands.add.options.reply.description
            )
            .setNameLocalizations({
              [Locale.ChineseTW]:
                translations["zh-TW"].subcommands.add.options.reply.name,
            })
            .setDescriptionLocalizations({
              [Locale.ChineseTW]:
                translations["zh-TW"].subcommands.add.options.reply.description,
            })
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName(translations["en-US"].subcommands.remove.name)
        .setDescription(translations["en-US"].subcommands.remove.description)
        .setNameLocalizations({
          [Locale.ChineseTW]: translations["zh-TW"].subcommands.remove.name,
        })
        .setDescriptionLocalizations({
          [Locale.ChineseTW]:
            translations["zh-TW"].subcommands.remove.description,
        })
        .addStringOption((option) =>
          option
            .setName(
              translations["en-US"].subcommands.remove.options.keyword.name
            )
            .setDescription(
              translations["en-US"].subcommands.remove.options.keyword
                .description
            )
            .setNameLocalizations({
              [Locale.ChineseTW]:
                translations["zh-TW"].subcommands.remove.options.keyword.name,
            })
            .setDescriptionLocalizations({
              [Locale.ChineseTW]:
                translations["zh-TW"].subcommands.remove.options.keyword
                  .description,
            })
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName(translations["en-US"].subcommands.list.name)
        .setDescription(translations["en-US"].subcommands.list.description)
        .setNameLocalizations({
          [Locale.ChineseTW]: translations["zh-TW"].subcommands.list.name,
        })
        .setDescriptionLocalizations({
          [Locale.ChineseTW]:
            translations["zh-TW"].subcommands.list.description,
        })
    ),

  async autocomplete(interaction: AutocompleteInteraction) {
    if (!interaction.guildId) return;
    const focusedValue = interaction.options.getFocused();
    const keywords = await getKeywordsByGuild(ticketPool, interaction.guildId);
    const choices = keywords
      .filter((kw) => kw.keyword.startsWith(focusedValue))
      .map((kw) => ({ name: kw.keyword, value: kw.keyword }));
    await interaction.respond(choices.slice(0, 25));
  },

  async execute(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand() || !interaction.guildId) return;

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

        await addKeyword(ticketPool, interaction.guildId, keyword, reply, type);
        flushKeywordsCache();
        await interaction.editReply(
          t.subcommands.add.responses.success.replace("{{keyword}}", keyword)
        );
      } else if (subcommand === "remove") {
        const keyword = interaction.options.getString(
          t.subcommands.remove.options.keyword.name,
          true
        );
        await removeKeyword(ticketPool, interaction.guildId, keyword);
        flushKeywordsCache();
        await interaction.editReply(
          t.subcommands.remove.responses.success.replace("{{keyword}}", keyword)
        );
      } else if (subcommand === "list") {
        const keywords = await getKeywordsByGuild(
          ticketPool,
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
