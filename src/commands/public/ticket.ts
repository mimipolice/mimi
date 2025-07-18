import {
  ChannelType,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { Command } from "../../interfaces/Command";
import { TicketManager } from "../../services/TicketManager";
import { ticketPool } from "../../shared/database";
import { getTicketByChannelId } from "../../shared/database/queries";
import { MessageFlags } from "discord-api-types/v10";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("Ticket commands.")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("add")
        .setDescription("Add a user to a ticket.")
        .addUserOption((option) =>
          option
            .setName("user")
            .setDescription("The user to add.")
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("remove")
        .setDescription("Remove a user from a ticket.")
        .addUserOption((option) =>
          option
            .setName("user")
            .setDescription("The user to remove.")
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("purge")
        .setDescription(
          "Permanently delete all tickets and reset the ID counter."
        )
    ),
  async execute(
    interaction,
    client,
    settingsManager,
    ticketManager: TicketManager
  ) {
    if (!interaction.isChatInputCommand()) return;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const subcommand = interaction.options.getSubcommand();
    if (subcommand === "purge") {
      if (
        !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
      ) {
        await interaction.editReply({
          content: "You do not have permission to use this command.",
        });
        return;
      }

      const confirmButton = new ButtonBuilder()
        .setCustomId(`confirm_purge:${interaction.user.id}`)
        .setLabel("Confirm Permanent Deletion")
        .setStyle(ButtonStyle.Danger);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        confirmButton
      );

      await interaction.editReply({
        content:
          "⚠️ **DANGER** ⚠️\nThis will permanently delete ALL tickets and reset the ID counter. This action cannot be undone.",
        components: [row],
      });
      return;
    }

    const user = interaction.options.getUser("user");
    const channel = interaction.channel;

    if (!user) {
      await interaction.editReply({ content: "User not found." });
      return;
    }

    if (!channel || channel.type !== ChannelType.GuildText) {
      await interaction.editReply({
        content: "This command can only be used in a ticket channel.",
      });
      return;
    }

    const ticketResult = await getTicketByChannelId(
      ticketPool,
      interaction.channelId
    );

    if (ticketResult.rowCount === 0) {
      await interaction.editReply({
        content: "This is not a valid ticket channel.",
      });
      return;
    }

    if (subcommand === "add") {
      await channel.permissionOverwrites.edit(user.id, {
        ViewChannel: true,
      });
      await interaction.editReply({
        content: `Successfully added ${user.tag} to the ticket.`,
      });
    } else if (subcommand === "remove") {
      await channel.permissionOverwrites.edit(user.id, {
        ViewChannel: false,
      });
      await interaction.editReply({
        content: `Successfully removed ${user.tag} from the ticket.`,
      });
    }
  },
};
