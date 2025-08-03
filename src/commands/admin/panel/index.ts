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
  Locale,
} from "discord.js";
import { Command, Databases, Services } from "../../../interfaces/Command";
import logger from "../../../utils/logger";
import { MessageFlags } from "discord-api-types/v10";
import { mimiDLCDb } from "../../../shared/database";
import { getLocalizations } from "../../../utils/localization";

const translations = getLocalizations("panel");

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
        .setName(translations["en-US"].subcommands.setup.name)
        .setDescription(translations["en-US"].subcommands.setup.description)
        .setNameLocalizations({
          [Locale.ChineseTW]: translations["zh-TW"].subcommands.setup.name,
        })
        .setDescriptionLocalizations({
          [Locale.ChineseTW]:
            translations["zh-TW"].subcommands.setup.description,
        })
    )
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
            .setName(translations["en-US"].subcommands.add.options.type_id.name)
            .setDescription(
              translations["en-US"].subcommands.add.options.type_id.description
            )
            .setNameLocalizations({
              [Locale.ChineseTW]:
                translations["zh-TW"].subcommands.add.options.type_id.name,
            })
            .setDescriptionLocalizations({
              [Locale.ChineseTW]:
                translations["zh-TW"].subcommands.add.options.type_id
                  .description,
            })
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName(translations["en-US"].subcommands.add.options.label.name)
            .setDescription(
              translations["en-US"].subcommands.add.options.label.description
            )
            .setNameLocalizations({
              [Locale.ChineseTW]:
                translations["zh-TW"].subcommands.add.options.label.name,
            })
            .setDescriptionLocalizations({
              [Locale.ChineseTW]:
                translations["zh-TW"].subcommands.add.options.label.description,
            })
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName(translations["en-US"].subcommands.add.options.style.name)
            .setDescription(
              translations["en-US"].subcommands.add.options.style.description
            )
            .setNameLocalizations({
              [Locale.ChineseTW]:
                translations["zh-TW"].subcommands.add.options.style.name,
            })
            .setDescriptionLocalizations({
              [Locale.ChineseTW]:
                translations["zh-TW"].subcommands.add.options.style.description,
            })
            .setRequired(false)
            .addChoices(
              {
                name: translations["en-US"].subcommands.add.options.style
                  .choices.Primary,
                value: "Primary",
                name_localizations: {
                  [Locale.ChineseTW]:
                    translations["zh-TW"].subcommands.add.options.style.choices
                      .Primary,
                },
              },
              {
                name: translations["en-US"].subcommands.add.options.style
                  .choices.Secondary,
                value: "Secondary",
                name_localizations: {
                  [Locale.ChineseTW]:
                    translations["zh-TW"].subcommands.add.options.style.choices
                      .Secondary,
                },
              },
              {
                name: translations["en-US"].subcommands.add.options.style
                  .choices.Success,
                value: "Success",
                name_localizations: {
                  [Locale.ChineseTW]:
                    translations["zh-TW"].subcommands.add.options.style.choices
                      .Success,
                },
              },
              {
                name: translations["en-US"].subcommands.add.options.style
                  .choices.Danger,
                value: "Danger",
                name_localizations: {
                  [Locale.ChineseTW]:
                    translations["zh-TW"].subcommands.add.options.style.choices
                      .Danger,
                },
              }
            )
        )
        .addStringOption((option) =>
          option
            .setName(translations["en-US"].subcommands.add.options.emoji.name)
            .setDescription(
              translations["en-US"].subcommands.add.options.emoji.description
            )
            .setNameLocalizations({
              [Locale.ChineseTW]:
                translations["zh-TW"].subcommands.add.options.emoji.name,
            })
            .setDescriptionLocalizations({
              [Locale.ChineseTW]:
                translations["zh-TW"].subcommands.add.options.emoji.description,
            })
            .setRequired(false)
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
              translations["en-US"].subcommands.remove.options.type_id.name
            )
            .setDescription(
              translations["en-US"].subcommands.remove.options.type_id
                .description
            )
            .setNameLocalizations({
              [Locale.ChineseTW]:
                translations["zh-TW"].subcommands.remove.options.type_id.name,
            })
            .setDescriptionLocalizations({
              [Locale.ChineseTW]:
                translations["zh-TW"].subcommands.remove.options.type_id
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
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName(translations["en-US"].subcommands.customize.name)
        .setDescription(translations["en-US"].subcommands.customize.description)
        .setNameLocalizations({
          [Locale.ChineseTW]: translations["zh-TW"].subcommands.customize.name,
        })
        .setDescriptionLocalizations({
          [Locale.ChineseTW]:
            translations["zh-TW"].subcommands.customize.description,
        })
        .addStringOption((option) =>
          option
            .setName(
              translations["en-US"].subcommands.customize.options.title.name
            )
            .setDescription(
              translations["en-US"].subcommands.customize.options.title
                .description
            )
            .setNameLocalizations({
              [Locale.ChineseTW]:
                translations["zh-TW"].subcommands.customize.options.title.name,
            })
            .setDescriptionLocalizations({
              [Locale.ChineseTW]:
                translations["zh-TW"].subcommands.customize.options.title
                  .description,
            })
            .setRequired(false)
        )
        .addStringOption((option) =>
          option
            .setName(
              translations["en-US"].subcommands.customize.options
                .author_icon_url.name
            )
            .setDescription(
              translations["en-US"].subcommands.customize.options
                .author_icon_url.description
            )
            .setNameLocalizations({
              [Locale.ChineseTW]:
                translations["zh-TW"].subcommands.customize.options
                  .author_icon_url.name,
            })
            .setDescriptionLocalizations({
              [Locale.ChineseTW]:
                translations["zh-TW"].subcommands.customize.options
                  .author_icon_url.description,
            })
            .setRequired(false)
        )
        .addStringOption((option) =>
          option
            .setName(
              translations["en-US"].subcommands.customize.options.thumbnail_url
                .name
            )
            .setDescription(
              translations["en-US"].subcommands.customize.options.thumbnail_url
                .description
            )
            .setNameLocalizations({
              [Locale.ChineseTW]:
                translations["zh-TW"].subcommands.customize.options
                  .thumbnail_url.name,
            })
            .setDescriptionLocalizations({
              [Locale.ChineseTW]:
                translations["zh-TW"].subcommands.customize.options
                  .thumbnail_url.description,
            })
            .setRequired(false)
        )
        .addStringOption((option) =>
          option
            .setName(
              translations["en-US"].subcommands.customize.options
                .footer_icon_url.name
            )
            .setDescription(
              translations["en-US"].subcommands.customize.options
                .footer_icon_url.description
            )
            .setNameLocalizations({
              [Locale.ChineseTW]:
                translations["zh-TW"].subcommands.customize.options
                  .footer_icon_url.name,
            })
            .setDescriptionLocalizations({
              [Locale.ChineseTW]:
                translations["zh-TW"].subcommands.customize.options
                  .footer_icon_url.description,
            })
            .setRequired(false)
        )
        .addStringOption((option) =>
          option
            .setName(
              translations["en-US"].subcommands.customize.options.message_id
                .name
            )
            .setDescription(
              translations["en-US"].subcommands.customize.options.message_id
                .description
            )
            .setNameLocalizations({
              [Locale.ChineseTW]:
                translations["zh-TW"].subcommands.customize.options.message_id
                  .name,
            })
            .setDescriptionLocalizations({
              [Locale.ChineseTW]:
                translations["zh-TW"].subcommands.customize.options.message_id
                  .description,
            })
            .setRequired(false)
        )
    ),
  async execute(
    interaction: ChatInputCommandInteraction,
    _client: Client,
    { settingsManager }: Services,
    { ticketDb: mimiDLCDb }: Databases
  ) {
    if (!interaction.guildId) {
      // This command is guild-only, but the check is here for type safety.
      return;
    }

    const t = translations[interaction.locale] || translations["en-US"];
    const subcommand = interaction.options.getSubcommand();

    try {
      if (subcommand === "setup") {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const settings = await settingsManager.getSettings(interaction.guildId);
        if (!settings || !settings.panelChannelId) {
          await interaction.editReply(t.subcommands.setup.responses.no_channel);
          return;
        }

        const channel = await interaction.guild?.channels.fetch(
          settings.panelChannelId
        );
        if (!channel || channel.type !== ChannelType.GuildText) {
          await interaction.editReply(
            t.subcommands.setup.responses.channel_not_found
          );
          return;
        }

        const ticketTypes = await mimiDLCDb
          .selectFrom("ticket_types")
          .selectAll()
          .where("guild_id", "=", interaction.guildId)
          .orderBy("id")
          .execute();

        if (ticketTypes.length === 0) {
          await interaction.editReply(t.subcommands.setup.responses.no_types);
          return;
        }

        const footerText = `Currently supports ${ticketTypes.length} services.`;
        const embed = new EmbedBuilder()
          .setColor("Green")
          .setDescription(
            settings.panelDescription ||
              "Please select a category below to open a new support ticket."
          );

        if (settings.panelAuthorIconUrl) {
          embed.setAuthor({
            name: settings.panelTitle || "Support",
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
          t.subcommands.setup.responses.success.replace(
            "{{channel}}",
            channel.toString()
          )
        );
      } else if (subcommand === "add") {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const typeId = interaction.options.getString(
          t.subcommands.add.options.type_id.name,
          true
        );
        const label = interaction.options.getString(
          t.subcommands.add.options.label.name,
          true
        );
        const style =
          interaction.options.getString(t.subcommands.add.options.style.name) ||
          "Secondary";
        const emoji = interaction.options.getString(
          t.subcommands.add.options.emoji.name
        );

        await mimiDLCDb
          .insertInto("ticket_types")
          .values({
            guild_id: interaction.guildId,
            type_id: typeId,
            label: label,
            style: style,
            emoji: emoji,
          })
          .execute();
        await interaction.editReply(
          t.subcommands.add.responses.success.replace("{{typeId}}", typeId)
        );
      } else if (subcommand === "remove") {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const typeId = interaction.options.getString(
          t.subcommands.remove.options.type_id.name,
          true
        );
        const result = await mimiDLCDb
          .deleteFrom("ticket_types")
          .where("guild_id", "=", interaction.guildId)
          .where("type_id", "=", typeId)
          .executeTakeFirst();

        if (result.numDeletedRows > 0) {
          await interaction.editReply(
            t.subcommands.remove.responses.success.replace("{{typeId}}", typeId)
          );
        } else {
          await interaction.editReply(
            t.subcommands.remove.responses.not_found.replace(
              "{{typeId}}",
              typeId
            )
          );
        }
      } else if (subcommand === "list") {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const ticketTypes = await mimiDLCDb
          .selectFrom("ticket_types")
          .selectAll()
          .where("guild_id", "=", interaction.guildId)
          .orderBy("id")
          .execute();

        if (ticketTypes.length === 0) {
          await interaction.editReply(t.subcommands.list.responses.no_types);
          return;
        }

        const embed = new EmbedBuilder()
          .setTitle(t.subcommands.list.responses.title)
          .setDescription(
            ticketTypes
              .map((type) =>
                t.subcommands.list.responses.type_line
                  .replace("{{label}}", type.label)
                  .replace("{{type_id}}", type.type_id)
                  .replace("{{emoji}}", type.emoji || "None")
              )
              .join("\n")
          );

        await interaction.editReply({ embeds: [embed] });
      } else if (subcommand === "customize") {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const panelTitle = interaction.options.getString(
          t.subcommands.customize.options.title.name
        );
        const panelAuthorIconUrl = interaction.options.getString(
          t.subcommands.customize.options.author_icon_url.name
        );
        const panelThumbnailUrl = interaction.options.getString(
          t.subcommands.customize.options.thumbnail_url.name
        );
        const panelFooterIconUrl = interaction.options.getString(
          t.subcommands.customize.options.footer_icon_url.name
        );
        const messageId = interaction.options.getString(
          t.subcommands.customize.options.message_id.name
        );

        if (
          !panelTitle &&
          !panelAuthorIconUrl &&
          !panelThumbnailUrl &&
          !panelFooterIconUrl &&
          !messageId
        ) {
          await interaction.editReply(
            t.subcommands.customize.responses.no_options
          );
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
              await interaction.editReply(
                t.subcommands.customize.responses.message_not_found
              );
              return;
            }
          } catch (error) {
            logger.error("Failed to fetch message:", error);
            await interaction.editReply(
              t.subcommands.customize.responses.message_fetch_error
            );
            return;
          }
        }

        await settingsManager.updateSettings(interaction.guildId, updateData);
        await interaction.editReply(t.subcommands.customize.responses.success);
      }
    } catch (error) {
      logger.error("Error in panel command:", error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: t.general_error,
          flags: MessageFlags.Ephemeral,
        });
      } else {
        await interaction.editReply({
          content: t.general_error,
        });
      }
    }
  },

  async autocomplete(interaction: AutocompleteInteraction) {
    if (!interaction.guildId) return;
    const t = translations[interaction.locale] || translations["en-US"];
    const focused = interaction.options.getFocused(true);

    if (
      focused.name === t.subcommands.remove.options.type_id.name ||
      focused.name === "type_id"
    ) {
      const ticketTypes = await mimiDLCDb
        .selectFrom("ticket_types")
        .selectAll()
        .where("guild_id", "=", interaction.guildId)
        .execute();
      const filtered = ticketTypes.filter((choice) =>
        choice.label.toLowerCase().includes(focused.value.toLowerCase())
      );

      await interaction.respond(
        filtered.map((choice) => ({
          name: t.autocomplete.type_id_choice
            .replace("{{label}}", choice.label)
            .replace("{{type_id}}", choice.type_id),
          value: choice.type_id,
        }))
      );
    }
  },
};

export default command;
