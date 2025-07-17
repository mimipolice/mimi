import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ChatInputCommandInteraction,
  Client,
  StringSelectMenuBuilder,
} from "discord.js";
import { Command } from "../../interfaces/Command";
import { SettingsManager } from "../../services/SettingsManager";
import { TicketManager } from "../../services/TicketManager";
import logger from "../../utils/logger";
import { Pool } from "pg";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("panel")
    .setDescription("Manage the ticket panel.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((subcommand) =>
      subcommand.setName("setup").setDescription("Setup the ticket panel.")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("add")
        .setDescription("Add a ticket type.")
        .addStringOption((option) =>
          option
            .setName("type_id")
            .setDescription("The unique ID for this ticket type.")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("label")
            .setDescription("The text to display on the button/option.")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("style")
            .setDescription("The button style.")
            .setRequired(false)
            .addChoices(
              { name: "Primary", value: "Primary" },
              { name: "Secondary", value: "Secondary" },
              { name: "Success", value: "Success" },
              { name: "Danger", value: "Danger" }
            )
        )
        .addStringOption((option) =>
          option
            .setName("emoji")
            .setDescription("The emoji to display.")
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("remove")
        .setDescription("Remove a ticket type.")
        .addStringOption((option) =>
          option
            .setName("type_id")
            .setDescription("The ID of the ticket type to remove.")
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("list").setDescription("List all ticket types.")
    ),
  async execute(
    interaction: ChatInputCommandInteraction,
    _client: Client,
    settingsManager: SettingsManager,
    _ticketManager: TicketManager,
    db: Pool
  ) {
    if (!interaction.guildId) {
      await interaction.reply({
        content: "This command can only be used in a server.",
        ephemeral: true,
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "setup") {
      await interaction.deferReply({ ephemeral: true });
      try {
        const settings = await settingsManager.getSettings(interaction.guildId);
        if (!settings || !settings.panelChannelId) {
          await interaction.editReply(
            "Panel channel is not configured. Please run `/config set panel_channel` first."
          );
          return;
        }

        const channel = await interaction.guild?.channels.fetch(
          settings.panelChannelId
        );
        if (!channel || channel.type !== ChannelType.GuildText) {
          await interaction.editReply(
            "The configured panel channel could not be found or is not a text channel."
          );
          return;
        }

        const { rows: ticketTypes } = await db.query(
          'SELECT * FROM ticket_types WHERE guild_id = $1 ORDER BY id',
          [interaction.guildId]
        );

        if (ticketTypes.length === 0) {
          await interaction.editReply(
            "No ticket types have been configured. Please add one with `/panel add` first."
          );
          return;
        }

        const embed = new EmbedBuilder()
          .setTitle("Ticket Support")
          .setDescription(
            "Please select a category below to open a new support ticket."
          )
          .setColor("Green");

        if (ticketTypes.length <= 5) {
          const row = new ActionRowBuilder<ButtonBuilder>();
          for (const type of ticketTypes) {
            const button = new ButtonBuilder()
              .setCustomId(`create_ticket:${type.type_id}`)
              .setLabel(type.label)
              .setStyle(ButtonStyle[type.style as keyof typeof ButtonStyle]);
            if (type.emoji) {
              button.setEmoji(type.emoji);
            }
            row.addComponents(button);
          }
          await channel.send({ embeds: [embed], components: [row] });
        } else {
          const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId("create_ticket_menu")
              .setPlaceholder("Select a ticket type...")
              .addOptions(
                ticketTypes.map((type) => ({
                  label: type.label,
                  value: `create_ticket:${type.type_id}`,
                  emoji: type.emoji || undefined,
                }))
              )
          );
          await channel.send({ embeds: [embed], components: [row] });
        }

        await interaction.editReply(
          `Ticket panel has been created in ${channel}.`
        );
      } catch (error) {
        logger.error("Error setting up panel:", error);
        await interaction.editReply(
          "An error occurred while creating the panel. Please check my permissions and try again."
        );
      }
    } else if (subcommand === "add") {
      const typeId = interaction.options.getString("type_id", true);
      const label = interaction.options.getString("label", true);
      const style = interaction.options.getString("style") || "Secondary";
      const emoji = interaction.options.getString("emoji");

      try {
        await db.query(
          'INSERT INTO ticket_types (guild_id, type_id, label, style, emoji) VALUES ($1, $2, $3, $4, $5)',
          [interaction.guildId, typeId, label, style, emoji]
        );
        await interaction.reply({
          content: `Ticket type "${label}" has been added.`,
          ephemeral: true,
        });
      } catch (error) {
        logger.error("Error adding ticket type:", error);
        await interaction.reply({
          content: "An error occurred. This `type_id` might already exist.",
          ephemeral: true,
        });
      }
    } else if (subcommand === "remove") {
      const typeId = interaction.options.getString("type_id", true);
      try {
        const result = await db.query(
          'DELETE FROM ticket_types WHERE guild_id = $1 AND type_id = $2',
          [interaction.guildId, typeId]
        );
        if (result?.rowCount && result.rowCount > 0) {
          await interaction.reply({
            content: `Ticket type with ID "${typeId}" has been removed.`,
            ephemeral: true,
          });
        } else {
          await interaction.reply({
            content: `Ticket type with ID "${typeId}" not found.`,
            ephemeral: true,
          });
        }
      } catch (error) {
        logger.error("Error removing ticket type:", error);
        await interaction.reply({
          content: "An error occurred while removing the ticket type.",
          ephemeral: true,
        });
      }
    } else if (subcommand === "list") {
      const { rows: ticketTypes } = await db.query(
        'SELECT * FROM ticket_types WHERE guild_id = $1 ORDER BY id',
        [interaction.guildId]
      );

      if (ticketTypes.length === 0) {
        await interaction.reply({
          content: "No ticket types configured.",
          ephemeral: true,
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle("Configured Ticket Types")
        .setDescription(
          ticketTypes
            .map(
              (t) =>
                `**Label:** ${t.label} | **ID:** \`${t.type_id}\` | **Style:** ${t.style} | **Emoji:** ${t.emoji || "None"}`
            )
            .join("\n")
        );

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};

export default command;
