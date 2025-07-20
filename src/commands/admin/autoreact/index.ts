import {
  SlashCommandBuilder,
  CommandInteraction,
  ChannelType,
  PermissionFlagsBits,
  Locale,
} from "discord.js";
import {
  setAutoreact,
  removeAutoreact,
  getAutoreacts,
} from "../../../shared/database/queries";
import { ticketPool } from "../../../shared/database";
import { loadCaches } from "../../../shared/cache";
import { MessageFlags } from "discord-api-types/v10";
import { getLocalizations } from "../../../utils/localization";

const translations = getLocalizations("autoreact");

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
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addSubcommand((subcommand) =>
      subcommand
        .setName(translations["en-US"].subcommands.set.name)
        .setDescription(translations["en-US"].subcommands.set.description)
        .setNameLocalizations({
          [Locale.ChineseTW]: translations["zh-TW"].subcommands.set.name,
        })
        .setDescriptionLocalizations({
          [Locale.ChineseTW]: translations["zh-TW"].subcommands.set.description,
        })
        .addStringOption((option) =>
          option
            .setName(translations["en-US"].subcommands.set.options.emoji.name)
            .setDescription(
              translations["en-US"].subcommands.set.options.emoji.description
            )
            .setNameLocalizations({
              [Locale.ChineseTW]:
                translations["zh-TW"].subcommands.set.options.emoji.name,
            })
            .setDescriptionLocalizations({
              [Locale.ChineseTW]:
                translations["zh-TW"].subcommands.set.options.emoji.description,
            })
            .setRequired(true)
        )
        .addChannelOption((option) =>
          option
            .setName(translations["en-US"].subcommands.set.options.channel.name)
            .setDescription(
              translations["en-US"].subcommands.set.options.channel.description
            )
            .setNameLocalizations({
              [Locale.ChineseTW]:
                translations["zh-TW"].subcommands.set.options.channel.name,
            })
            .setDescriptionLocalizations({
              [Locale.ChineseTW]:
                translations["zh-TW"].subcommands.set.options.channel
                  .description,
            })
            .addChannelTypes(ChannelType.GuildText)
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
        .addChannelOption((option) =>
          option
            .setName(
              translations["en-US"].subcommands.remove.options.channel.name
            )
            .setDescription(
              translations["en-US"].subcommands.remove.options.channel
                .description
            )
            .setNameLocalizations({
              [Locale.ChineseTW]:
                translations["zh-TW"].subcommands.remove.options.channel.name,
            })
            .setDescriptionLocalizations({
              [Locale.ChineseTW]:
                translations["zh-TW"].subcommands.remove.options.channel
                  .description,
            })
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
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

  async execute(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand() || !interaction.guildId) return;

    const t = translations[interaction.locale] || translations["en-US"];
    const subcommand = interaction.options.getSubcommand();

    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === "set") {
        const emoji = interaction.options.getString(
          t.subcommands.set.options.emoji.name,
          true
        );
        const channel = interaction.options.getChannel(
          t.subcommands.set.options.channel.name,
          true
        );
        await setAutoreact(ticketPool, interaction.guildId, channel.id, emoji);
        await loadCaches();
        await interaction.editReply(
          t.subcommands.set.responses.success
            .replace("{{emoji}}", emoji)
            .replace("{{channelId}}", channel.id)
        );
      } else if (subcommand === "remove") {
        const channel = interaction.options.getChannel(
          t.subcommands.remove.options.channel.name,
          true
        );
        await removeAutoreact(ticketPool, interaction.guildId, channel.id);
        await loadCaches();
        await interaction.editReply(
          t.subcommands.remove.responses.success.replace(
            "{{channelId}}",
            channel.id
          )
        );
      } else if (subcommand === "list") {
        const autoreacts = await getAutoreacts(ticketPool, interaction.guildId);
        if (autoreacts.length === 0) {
          await interaction.editReply(t.subcommands.list.responses.no_configs);
          return;
        }
        const list = autoreacts
          .map((ar) =>
            t.subcommands.list.responses.list_item
              .replace("{{channelId}}", ar.channel_id)
              .replace("{{emoji}}", ar.emoji)
          )
          .join("\n");
        await interaction.editReply(
          `${t.subcommands.list.responses.title}\n${list}`
        );
      }
    } catch (error) {
      console.error("Autoreact command error:", error);
      await interaction.editReply(t.general_error);
    }
  },
};
