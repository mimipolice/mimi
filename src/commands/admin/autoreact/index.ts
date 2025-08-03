import {
  SlashCommandBuilder,
  CommandInteraction,
  ChannelType,
  PermissionFlagsBits,
  Locale,
  Client,
} from "discord.js";
import {
  setAutoreact,
  removeAutoreact,
  getAutoreacts,
} from "../../../shared/database/queries";
import { flushAutoreactsForGuild } from "../../../shared/cache";
import { MessageFlags } from "discord-api-types/v10";
import { getLocalizations } from "../../../utils/localization";
import logger from "../../../utils/logger";
import { Command, Databases, Services } from "../../../interfaces/Command";

export default {
  data: new SlashCommandBuilder()
    .setName("autoreact")
    .setDescription("Manage autoreactions.")
    .setNameLocalizations({
      [Locale.ChineseTW]: "自動反應",
    })
    .setDescriptionLocalizations({
      [Locale.ChineseTW]: "管理自動反應。",
    })
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("set")
        .setDescription("Set an autoreaction.")
        .setNameLocalizations({
          [Locale.ChineseTW]: "設定",
        })
        .setDescriptionLocalizations({
          [Locale.ChineseTW]: "設定自動反應。",
        })
        .addStringOption((option) =>
          option
            .setName("emoji")
            .setDescription("The emoji to react with.")
            .setNameLocalizations({
              [Locale.ChineseTW]: "表情符號",
            })
            .setDescriptionLocalizations({
              [Locale.ChineseTW]: "要用來反應的表情符號。",
            })
            .setRequired(true)
        )
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("The channel to react in.")
            .setNameLocalizations({
              [Locale.ChineseTW]: "頻道",
            })
            .setDescriptionLocalizations({
              [Locale.ChineseTW]: "要在其中反應的頻道。",
            })
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("remove")
        .setDescription("Remove an autoreaction.")
        .setNameLocalizations({
          [Locale.ChineseTW]: "移除",
        })
        .setDescriptionLocalizations({
          [Locale.ChineseTW]: "移除自動反應。",
        })
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("The channel to remove the autoreaction from.")
            .setNameLocalizations({
              [Locale.ChineseTW]: "頻道",
            })
            .setDescriptionLocalizations({
              [Locale.ChineseTW]: "要從中移除自動反應的頻道。",
            })
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("list")
        .setDescription("List all autoreactions.")
        .setNameLocalizations({
          [Locale.ChineseTW]: "列表",
        })
        .setDescriptionLocalizations({
          [Locale.ChineseTW]: "列出所有自動反應。",
        })
    ),

  async execute(
    interaction: CommandInteraction,
    _client: Client,
    { localizationManager }: Services,
    { ticketDb: mimiDLCDb }: Databases
  ) {
    if (!interaction.isChatInputCommand() || !interaction.guildId) return;

    const translations = getLocalizations(localizationManager, "autoreact");
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
        await setAutoreact(mimiDLCDb, interaction.guildId, channel.id, emoji);
        flushAutoreactsForGuild(interaction.guildId);
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
        await removeAutoreact(mimiDLCDb, interaction.guildId, channel.id);
        flushAutoreactsForGuild(interaction.guildId);
        await interaction.editReply(
          t.subcommands.remove.responses.success.replace(
            "{{channelId}}",
            channel.id
          )
        );
      } else if (subcommand === "list") {
        const autoreacts = await getAutoreacts(mimiDLCDb, interaction.guildId);
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
      logger.error("Autoreact command error:", error);
      await interaction.editReply(t.general_error);
    }
  },
};
