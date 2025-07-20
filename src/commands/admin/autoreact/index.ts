import {
  SlashCommandBuilder,
  CommandInteraction,
  ChannelType,
  PermissionFlagsBits,
} from "discord.js";
import {
  setAutoreact,
  removeAutoreact,
  getAutoreacts,
} from "../../../shared/database/queries";
import { ticketPool } from "../../../shared/database";
import { loadCaches } from "../../../shared/cache";
import { MessageFlags } from "discord-api-types/v10";

export default {
  data: new SlashCommandBuilder()
    .setName("autoreact")
    .setDescription("Manages auto-reactions for channels.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("set")
        .setDescription("Sets an auto-reaction for a channel.")
        .addStringOption((option) =>
          option
            .setName("emoji")
            .setDescription("The emoji to react with.")
            .setRequired(true)
        )
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("The channel to set the auto-reaction for.")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("remove")
        .setDescription("Removes the auto-reaction from a channel.")
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("The channel to remove the auto-reaction from.")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("list")
        .setDescription("Lists all auto-reaction configurations.")
    ),

  async execute(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand() || !interaction.guildId) return;

    const subcommand = interaction.options.getSubcommand();

    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === "set") {
        const emoji = interaction.options.getString("emoji", true);
        const channel = interaction.options.getChannel("channel", true);
        await setAutoreact(ticketPool, interaction.guildId, channel.id, emoji);
        await loadCaches();
        await interaction.editReply(
          `Auto-reaction set to ${emoji} for <#${channel.id}>.`
        );
      } else if (subcommand === "remove") {
        const channel = interaction.options.getChannel("channel", true);
        await removeAutoreact(ticketPool, interaction.guildId, channel.id);
        await loadCaches();
        await interaction.editReply(
          `Auto-reaction removed from <#${channel.id}>.`
        );
      } else if (subcommand === "list") {
        const autoreacts = await getAutoreacts(ticketPool, interaction.guildId);
        if (autoreacts.length === 0) {
          await interaction.editReply("No auto-reactions are set up.");
          return;
        }
        const list = autoreacts
          .map((ar) => `<#${ar.channel_id}>: ${ar.emoji}`)
          .join("\n");
        await interaction.editReply(`**Auto-reactions:**\n${list}`);
      }
    } catch (error) {
      console.error("Autoreact command error:", error);
      await interaction.editReply(
        "An error occurred while managing auto-reactions."
      );
    }
  },
};
