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
    .setNameLocalizations({
      [Locale.ChineseTW]: "面板",
    })
    .setDescriptionLocalizations({
      [Locale.ChineseTW]: "管理服務單面板。",
    })
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("setup")
        .setDescription("Setup the ticket panel.")
        .setNameLocalizations({
          [Locale.ChineseTW]: "設定",
        })
        .setDescriptionLocalizations({
          [Locale.ChineseTW]: "設定服務單面板。",
        })
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("add")
        .setDescription("Add a ticket type to the panel.")
        .setNameLocalizations({
          [Locale.ChineseTW]: "新增",
        })
        .setDescriptionLocalizations({
          [Locale.ChineseTW]: "將服務單類型新增至面板。",
        })
        .addStringOption((option) =>
          option
            .setName("type_id")
            .setDescription("The ID of the ticket type.")
            .setNameLocalizations({
              [Locale.ChineseTW]: "type_id",
            })
            .setDescriptionLocalizations({
              [Locale.ChineseTW]: "服務單類型的id。",
            })
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("label")
            .setDescription("The label for the button/option.")
            .setNameLocalizations({
              [Locale.ChineseTW]: "標籤",
            })
            .setDescriptionLocalizations({
              [Locale.ChineseTW]: "按鈕/選項的標籤。",
            })
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("style")
            .setDescription("The style of the button.")
            .setNameLocalizations({
              [Locale.ChineseTW]: "樣式",
            })
            .setDescriptionLocalizations({
              [Locale.ChineseTW]: "按鈕的樣式。",
            })
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
            .setDescription("The emoji for the button/option.")
            .setNameLocalizations({
              [Locale.ChineseTW]: "表情符號",
            })
            .setDescriptionLocalizations({
              [Locale.ChineseTW]: "按鈕/選項的表情符號。",
            })
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("remove")
        .setDescription("Remove a ticket type from the panel.")
        .setNameLocalizations({
          [Locale.ChineseTW]: "移除",
        })
        .setDescriptionLocalizations({
          [Locale.ChineseTW]: "從面板移除服務單類型。",
        })
        .addStringOption((option) =>
          option
            .setName("type_id")
            .setDescription("The ID of the ticket type to remove.")
            .setNameLocalizations({
              [Locale.ChineseTW]: "類型id",
            })
            .setDescriptionLocalizations({
              [Locale.ChineseTW]: "要移除的服務單類型id。",
            })
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("list")
        .setDescription("List all ticket types.")
        .setNameLocalizations({
          [Locale.ChineseTW]: "列表",
        })
        .setDescriptionLocalizations({
          [Locale.ChineseTW]: "列出所有服務單類型。",
        })
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("customize")
        .setDescription("Customize the ticket panel embed.")
        .setNameLocalizations({
          [Locale.ChineseTW]: "自訂",
        })
        .setDescriptionLocalizations({
          [Locale.ChineseTW]: "自訂服務單面板嵌入。",
        })
        .addStringOption((option) =>
          option
            .setName("title")
            .setDescription("The title of the embed.")
            .setNameLocalizations({
              [Locale.ChineseTW]: "標題",
            })
            .setDescriptionLocalizations({
              [Locale.ChineseTW]: "嵌入的標題。",
            })
            .setRequired(false)
        )
        .addStringOption((option) =>
          option
            .setName("author_icon_url")
            .setDescription("The URL of the author icon.")
            .setNameLocalizations({
              [Locale.ChineseTW]: "author_icon_url",
            })
            .setDescriptionLocalizations({
              [Locale.ChineseTW]: "作者圖示的URL。",
            })
            .setRequired(false)
        )
        .addStringOption((option) =>
          option
            .setName("thumbnail_url")
            .setDescription("The URL of the thumbnail.")
            .setNameLocalizations({
              [Locale.ChineseTW]: "thumbnail_url",
            })
            .setDescriptionLocalizations({
              [Locale.ChineseTW]: "縮圖的URL。",
            })
            .setRequired(false)
        )
        .addStringOption((option) =>
          option
            .setName("footer_icon_url")
            .setDescription("The URL of the footer icon.")
            .setNameLocalizations({
              [Locale.ChineseTW]: "footer_icon_url",
            })
            .setDescriptionLocalizations({
              [Locale.ChineseTW]: "頁腳圖示的URL。",
            })
            .setRequired(false)
        )
        .addStringOption((option) =>
          option
            .setName("message_id")
            .setDescription("The ID of a message to use as the description.")
            .setNameLocalizations({
              [Locale.ChineseTW]: "message_id",
            })
            .setDescriptionLocalizations({
              [Locale.ChineseTW]: "用作說明的訊息id。",
            })
            .setRequired(false)
        )
    ),
  async execute(
    interaction: ChatInputCommandInteraction,
    _client: Client,
    { settingsManager, localizationManager }: Services,
    { ticketDb: mimiDLCDb }: Databases
  ) {
    if (!interaction.guildId) {
      // This command is guild-only, but the check is here for type safety.
      return;
    }

    const translations = getLocalizations(localizationManager, "panel");
    const t = translations[interaction.locale] || translations["en-US"];
    const subcommand = interaction.options.getSubcommand();

    try {
      if (subcommand === "setup") {
        if (!interaction.deferred && !interaction.replied) {
          await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        }
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

        const footerText = t.subcommands.setup.responses.footer_text.replace(
          "{{count}}",
          ticketTypes.length.toString()
        );
        const embed = new EmbedBuilder()
          .setColor("Green")
          .setDescription(
            settings.panelDescription ||
            t.subcommands.setup.responses.default_description
          );

        if (settings.panelAuthorIconUrl) {
          embed.setAuthor({
            name: settings.panelTitle || t.subcommands.setup.responses.default_title,
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
                .setPlaceholder(t.subcommands.setup.responses.select_placeholder)
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
        if (!interaction.deferred && !interaction.replied) {
          await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        }
        // Use English option names (as defined in SlashCommandBuilder)
        const typeId = interaction.options.getString("type_id", true);
        const label = interaction.options.getString("label", true);
        const style = interaction.options.getString("style") || "Secondary";
        const emoji = interaction.options.getString("emoji");

        // Note: ticket_types 表沒有外鍵約束，無需預先插入 guilds 表
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
        if (!interaction.deferred && !interaction.replied) {
          await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        }
        // Use English option name
        const typeId = interaction.options.getString("type_id", true);
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
        if (!interaction.deferred && !interaction.replied) {
          await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        }
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
        if (!interaction.deferred && !interaction.replied) {
          await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        }
        // Use English option names
        const panelTitle = interaction.options.getString("title");
        const panelAuthorIconUrl = interaction.options.getString("author_icon_url");
        const panelThumbnailUrl = interaction.options.getString("thumbnail_url");
        const panelFooterIconUrl = interaction.options.getString("footer_icon_url");
        const messageId = interaction.options.getString("message_id");

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
      logger.error(`Error in panel command (by <@${interaction.user.id}> / ${interaction.user.id}):`, error);
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
    const focused = interaction.options.getFocused(true);

    if (focused.name === "type_id") {
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
          name: `${choice.label} (${choice.type_id})`,
          value: choice.type_id,
        }))
      );
    }
  },
};

export default command;
