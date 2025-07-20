import {
  ChatInputCommandInteraction,
  Client,
  SlashCommandBuilder,
  PermissionFlagsBits,
  Locale,
} from "discord.js";
import { Command } from "../../../interfaces/Command";
import { SettingsManager } from "../../../services/SettingsManager";
import { TicketManager } from "../../../services/TicketManager";
import { MessageFlags } from "discord-api-types/v10";
import { getLocalizations } from "../../../utils/localization";

const translations = getLocalizations("config");

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
        .setName(translations["en-US"].subcommands.set.name)
        .setDescription(translations["en-US"].subcommands.set.description)
        .setNameLocalizations({
          [Locale.ChineseTW]: translations["zh-TW"].subcommands.set.name,
        })
        .setDescriptionLocalizations({
          [Locale.ChineseTW]: translations["zh-TW"].subcommands.set.description,
        })
        .addRoleOption((option) =>
          option
            .setName(
              translations["en-US"].subcommands.set.options.staff_role.name
            )
            .setDescription(
              translations["en-US"].subcommands.set.options.staff_role
                .description
            )
            .setNameLocalizations({
              [Locale.ChineseTW]:
                translations["zh-TW"].subcommands.set.options.staff_role.name,
            })
            .setDescriptionLocalizations({
              [Locale.ChineseTW]:
                translations["zh-TW"].subcommands.set.options.staff_role
                  .description,
            })
            .setRequired(true)
        )
        .addChannelOption((option) =>
          option
            .setName(
              translations["en-US"].subcommands.set.options.ticket_category.name
            )
            .setDescription(
              translations["en-US"].subcommands.set.options.ticket_category
                .description
            )
            .setNameLocalizations({
              [Locale.ChineseTW]:
                translations["zh-TW"].subcommands.set.options.ticket_category
                  .name,
            })
            .setDescriptionLocalizations({
              [Locale.ChineseTW]:
                translations["zh-TW"].subcommands.set.options.ticket_category
                  .description,
            })
            .setRequired(true)
        )
        .addChannelOption((option) =>
          option
            .setName(
              translations["en-US"].subcommands.set.options.log_channel.name
            )
            .setDescription(
              translations["en-US"].subcommands.set.options.log_channel
                .description
            )
            .setNameLocalizations({
              [Locale.ChineseTW]:
                translations["zh-TW"].subcommands.set.options.log_channel.name,
            })
            .setDescriptionLocalizations({
              [Locale.ChineseTW]:
                translations["zh-TW"].subcommands.set.options.log_channel
                  .description,
            })
            .setRequired(true)
        )
        .addChannelOption((option) =>
          option
            .setName(
              translations["en-US"].subcommands.set.options.panel_channel.name
            )
            .setDescription(
              translations["en-US"].subcommands.set.options.panel_channel
                .description
            )
            .setNameLocalizations({
              [Locale.ChineseTW]:
                translations["zh-TW"].subcommands.set.options.panel_channel
                  .name,
            })
            .setDescriptionLocalizations({
              [Locale.ChineseTW]:
                translations["zh-TW"].subcommands.set.options.panel_channel
                  .description,
            })
            .setRequired(true)
        )
        .addChannelOption((option) =>
          option
            .setName(
              translations["en-US"].subcommands.set.options.archive_category
                .name
            )
            .setDescription(
              translations["en-US"].subcommands.set.options.archive_category
                .description
            )
            .setNameLocalizations({
              [Locale.ChineseTW]:
                translations["zh-TW"].subcommands.set.options.archive_category
                  .name,
            })
            .setDescriptionLocalizations({
              [Locale.ChineseTW]:
                translations["zh-TW"].subcommands.set.options.archive_category
                  .description,
            })
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName(translations["en-US"].subcommands.view.name)
        .setDescription(translations["en-US"].subcommands.view.description)
        .setNameLocalizations({
          [Locale.ChineseTW]: translations["zh-TW"].subcommands.view.name,
        })
        .setDescriptionLocalizations({
          [Locale.ChineseTW]:
            translations["zh-TW"].subcommands.view.description,
        })
    ),
  async execute(
    interaction: ChatInputCommandInteraction,
    client: Client,
    settingsManager: SettingsManager,
    _ticketManager: TicketManager
  ) {
    if (!interaction.isChatInputCommand() || !interaction.guildId) return;

    const t = translations[interaction.locale] || translations["en-US"];
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "set") {
      const staffRoleId = interaction.options.getRole(
        t.subcommands.set.options.staff_role.name
      )?.id;
      const ticketCategoryId = interaction.options.getChannel(
        t.subcommands.set.options.ticket_category.name
      )?.id;
      const logChannelId = interaction.options.getChannel(
        t.subcommands.set.options.log_channel.name
      )?.id;
      const panelChannelId = interaction.options.getChannel(
        t.subcommands.set.options.panel_channel.name
      )?.id;
      const archiveCategoryId = interaction.options.getChannel(
        t.subcommands.set.options.archive_category.name
      )?.id;

      if (
        staffRoleId &&
        ticketCategoryId &&
        logChannelId &&
        panelChannelId &&
        archiveCategoryId
      ) {
        await settingsManager.updateSettings(interaction.guildId, {
          staffRoleId: staffRoleId,
          ticketCategoryId: ticketCategoryId,
          logChannelId: logChannelId,
          panelChannelId: panelChannelId,
          archiveCategoryId: archiveCategoryId,
        });
        await interaction.editReply({
          content: t.subcommands.set.responses.success,
        });
      } else {
        await interaction.editReply({
          content: t.subcommands.set.responses.error,
        });
      }
    } else if (subcommand === "view") {
      const settings = await settingsManager.getSettings(interaction.guildId);
      if (settings) {
        const viewResponse = `
${t.subcommands.view.responses.title}
${t.subcommands.view.responses.staff_role} <@&${settings.staffRoleId}>
${t.subcommands.view.responses.ticket_category} <#${settings.ticketCategoryId}>
${t.subcommands.view.responses.log_channel} <#${settings.logChannelId}>
${t.subcommands.view.responses.panel_channel} <#${settings.panelChannelId}>
${t.subcommands.view.responses.archive_category} <#${settings.archiveCategoryId}>
          `;
        await interaction.editReply({
          content: viewResponse,
        });
      } else {
        await interaction.editReply({
          content: t.subcommands.view.responses.no_config,
        });
      }
    }
  },
};
