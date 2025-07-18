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
  AutocompleteInteraction,
} from "discord.js";
import { Command } from "../../interfaces/Command";
import { SettingsManager } from "../../services/SettingsManager";
import { TicketManager } from "../../services/TicketManager";
import logger from "../../utils/logger";
import { MessageFlags } from "discord-api-types/v10";
import { ticketDB } from "../../shared/database";

function mapStyleToButtonStyle(style: string): ButtonStyle {
  switch (style.toLowerCase()) {
    case "primary":
      return ButtonStyle.Primary;
    case "success":
      return ButtonStyle.Success;
    case "danger":
      return ButtonStyle.Danger;
    case "secondary":
    default:
      return ButtonStyle.Secondary;
  }
}

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
            .setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("list").setDescription("List all ticket types.")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("customize")
        .setDescription("Customize the ticket panel's embed.")
        .addStringOption((option) =>
          option
            .setName("title")
            .setDescription("The Title for the embed.")
            .setRequired(false)
        )
        .addStringOption((option) =>
          option
            .setName("author_icon_url")
            .setDescription("The author icon URL for the embed.")
            .setRequired(false)
        )
        .addStringOption((option) =>
          option
            .setName("thumbnail_url")
            .setDescription("The thumbnail URL for the embed.")
            .setRequired(false)
        )
        .addStringOption((option) =>
          option
            .setName("footer_icon_url")
            .setDescription("The footer icon URL for the embed.")
            .setRequired(false)
        )
        .addStringOption((option) =>
          option
            .setName("message_id")
            .setDescription(
              "The ID of the message to use as the panel description."
            )
            .setRequired(false)
        )
    ),
  async execute(
    interaction: ChatInputCommandInteraction,
    _client: Client,
    settingsManager: SettingsManager,
    _ticketManager: TicketManager,
    _db: any
  ) {
    if (!interaction.guildId) {
      await interaction.reply({
        content: "This command can only be used in a server.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "setup") {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
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

        const ticketTypes = await ticketDB
          .selectFrom("ticket_types")
          .selectAll()
          .where("guild_id", "=", interaction.guildId)
          .orderBy("id")
          .execute();

        if (ticketTypes.length === 0) {
          await interaction.editReply(
            "No ticket types have been configured. Please add one with `/panel add` first."
          );
          return;
        }

        const footerText = `Currently supports ${ticketTypes.length} services.`;
        const embed = new EmbedBuilder()
          .setColor("Green")
          .setTitle(settings.panelTitle || "Support Tickets")
          .setDescription(
            settings.panelDescription ||
              "Please select a category below to open a new support ticket."
          );

        if (settings.panelAuthorIconUrl) {
          embed.setAuthor({
            name: interaction.guild?.name || "Support",
            iconURL: settings.panelAuthorIconUrl,
          });
        }

        if (settings.panelThumbnailUrl) {
          embed.setThumbnail(settings.panelThumbnailUrl);
        }

        embed.setFooter({
          text: footerText,
          iconURL: settings.panelFooterIconUrl || undefined,
        });

        if (ticketTypes.length <= 5) {
          const row = new ActionRowBuilder<ButtonBuilder>();
          for (const type of ticketTypes) {
            const button = new ButtonBuilder()
              .setCustomId(`create_ticket:${type.type_id}`)
              .setLabel(type.label)
              .setStyle(mapStyleToButtonStyle(type.style));
            if (type.emoji) {
              button.setEmoji(type.emoji);
            }
            row.addComponents(button);
          }
          await channel.send({ embeds: [embed], components: [row] });
        } else {
          const row =
            new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
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
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const typeId = interaction.options.getString("type_id", true);
      const label = interaction.options.getString("label", true);
      const style = interaction.options.getString("style") || "Secondary";
      const emoji = interaction.options.getString("emoji");

      try {
        await ticketDB
          .insertInto("ticket_types")
          .values({
            guild_id: interaction.guildId,
            type_id: typeId,
            label: label,
            style: style,
            emoji: emoji,
          })
          .execute();
        await interaction.editReply({
          content: `Ticket type \`${typeId}\` has been saved.`,
        });
      } catch (error) {
        logger.error("Error saving ticket type:", error);
        await interaction.editReply({
          content: "An error occurred while saving the ticket type.",
        });
      }
    } else if (subcommand === "remove") {
      const typeId = interaction.options.getString("type_id", true);
      try {
        const result = await ticketDB
          .deleteFrom("ticket_types")
          .where("guild_id", "=", interaction.guildId)
          .where("type_id", "=", typeId)
          .executeTakeFirst();
        if (result.numDeletedRows > 0) {
          await interaction.reply({
            content: `Ticket type with ID \`${typeId}\` has been removed.`,
            flags: MessageFlags.Ephemeral,
          });
        } else {
          await interaction.reply({
            content: `Ticket type with ID \`${typeId}\` not found.`,
            flags: MessageFlags.Ephemeral,
          });
        }
      } catch (error) {
        logger.error("Error removing ticket type:", error);
        await interaction.reply({
          content: "An error occurred while removing the ticket type.",
          flags: MessageFlags.Ephemeral,
        });
      }
    } else if (subcommand === "list") {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const ticketTypes = await ticketDB
        .selectFrom("ticket_types")
        .selectAll()
        .where("guild_id", "=", interaction.guildId)
        .orderBy("id")
        .execute();

      if (ticketTypes.length === 0) {
        await interaction.editReply({
          content: "No ticket types configured.",
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle("Configured Ticket Types")
        .setDescription(
          ticketTypes
            .map(
              (t) =>
                `**Label:** ${t.label} | **ID:** \`${
                  t.type_id
                }\` | **Emoji:** ${t.emoji || "None"}`
            )
            .join("\n")
        );

      await interaction.editReply({ embeds: [embed] });
    } else if (subcommand === "customize") {
      const panelTitle = interaction.options.getString("title");
      const panelAuthorIconUrl =
        interaction.options.getString("author_icon_url");
      const panelThumbnailUrl = interaction.options.getString("thumbnail_url");
      const panelFooterIconUrl =
        interaction.options.getString("footer_icon_url");
      const messageId = interaction.options.getString("message_id");

      if (
        !panelTitle &&
        !panelAuthorIconUrl &&
        !panelThumbnailUrl &&
        !panelFooterIconUrl &&
        !messageId
      ) {
        await interaction.reply({
          content: "You must provide at least one option to customize.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const updateData: { [key: string]: string | null } = {};
      if (panelTitle) updateData.panelTitle = panelTitle;
      if (panelAuthorIconUrl)
        updateData.panelAuthorIconUrl = panelAuthorIconUrl;
      if (panelThumbnailUrl) updateData.panelThumbnailUrl = panelThumbnailUrl;
      if (panelFooterIconUrl)
        updateData.panelFooterIconUrl = panelFooterIconUrl;

      if (messageId) {
        try {
          const fetchedMessage = await interaction.channel?.messages.fetch(
            messageId
          );
          if (fetchedMessage) {
            updateData.panelDescription = fetchedMessage.content;
            await fetchedMessage.delete();
          } else {
            await interaction.reply({
              content: "Message not found.",
              flags: MessageFlags.Ephemeral,
            });
            return;
          }
        } catch (error) {
          logger.error("Failed to fetch message:", error);
          await interaction.reply({
            content:
              "Could not fetch the message. Make sure the ID is correct and I have permission to read and delete messages in this channel.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
      }

      try {
        await settingsManager.updateSettings(interaction.guildId, updateData);

        await interaction.reply({
          content: "The ticket panel has been customized.",
          flags: MessageFlags.Ephemeral,
        });
      } catch (error) {
        logger.error("Error customizing panel:", error);
        await interaction.reply({
          content: "An error occurred while customizing the panel.",
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  },

  async autocomplete(interaction: AutocompleteInteraction) {
    if (!interaction.guildId) return;
    const focused = interaction.options.getFocused(true);

    if (focused.name === "type_id") {
      const ticketTypes = await ticketDB
        .selectFrom("ticket_types")
        .selectAll()
        .where("guild_id", "=", interaction.guildId)
        .execute();
      const filtered = ticketTypes.filter((choice) =>
        choice.label.toLowerCase().includes(focused.value.toLowerCase())
      );

      await interaction.respond(
        filtered.map((choice) => ({
          name: `${choice.label} (${choice.type_id})`,
          value: choice.type_id,
        }))
      );
    }
  },
};

export default command;
