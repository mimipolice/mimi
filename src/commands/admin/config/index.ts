import {
  ChatInputCommandInteraction,
  Client,
  SlashCommandBuilder,
  PermissionFlagsBits,
  Locale,
} from "discord.js";
import { Command, Databases, Services } from "../../../interfaces/Command";
import { MessageFlags } from "discord-api-types/v10";
import { getLocalizations } from "../../../utils/localization";
import {
  getAntiSpamLogChannel,
  setAntiSpamLogChannel,
} from "../../../shared/database/queries";

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
        .addChannelOption((option) =>
          option
            .setName("anti_spam_log_channel")
            .setDescription(
              "Set the channel for anti-spam logs. (防洗版日誌頻道)"
            )
            .setRequired(false)
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
    { settingsManager }: Services,
    _databases: Databases
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

      // This is not ideal, as it requires all settings at once.
      // A better implementation would update settings individually.
      // For now, we will just handle the new option separately.

      const antiSpamLogChannelId = interaction.options.getChannel(
        "anti_spam_log_channel"
      )?.id;

      let updated = false;
      let responseContent = "";

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
        responseContent += t.subcommands.set.responses.success + "\n";
        updated = true;
      }

      if (antiSpamLogChannelId) {
        await setAntiSpamLogChannel(interaction.guildId, antiSpamLogChannelId);
        responseContent += `Anti-spam log channel set to <#${antiSpamLogChannelId}>.\n`;
        updated = true;
      }

      if (updated) {
        await interaction.editReply({ content: responseContent });
      } else {
        await interaction.editReply({
          content:
            "No settings were provided to update. Please provide at least one option.",
        });
      }
    } else if (subcommand === "view") {
      const settings = await settingsManager.getSettings(interaction.guildId);
      const antiSpamLogChannel = await getAntiSpamLogChannel(
        interaction.guildId
      );

      let viewResponse = t.subcommands.view.responses.no_config;

      if (settings) {
        viewResponse = `
${t.subcommands.view.responses.title}
${t.subcommands.view.responses.staff_role} <@&${settings.staffRoleId}>
${t.subcommands.view.responses.ticket_category} <#${settings.ticketCategoryId}>
${t.subcommands.view.responses.log_channel} <#${settings.logChannelId}>
${t.subcommands.view.responses.panel_channel} <#${settings.panelChannelId}>
${t.subcommands.view.responses.archive_category} <#${settings.archiveCategoryId}>
          `;
      }

      if (antiSpamLogChannel) {
        if (viewResponse === t.subcommands.view.responses.no_config) {
          viewResponse = "**Anti-Spam Settings**\n";
        }
        viewResponse += `\n**Anti-Spam Log Channel**: <#${antiSpamLogChannel}>`;
      }

      await interaction.editReply({
        content: viewResponse,
      });
    }
  },
};
