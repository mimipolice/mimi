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
  upsertAntiSpamSettings,
  deleteAntiSpamSettings,
} from "../../../shared/database/queries";
import {
  flushAntiSpamSettingsForGuild,
  getAntiSpamSettingsForGuild,
} from "../../../shared/cache";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("config")
    .setDescription("Configure server settings.")
    .setNameLocalizations({
      [Locale.ChineseTW]: "設定",
    })
    .setDescriptionLocalizations({
      [Locale.ChineseTW]: "設定伺服器。",
    })
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("set")
        .setDescription("Set server settings.")
        .setNameLocalizations({
          [Locale.ChineseTW]: "設定",
        })
        .setDescriptionLocalizations({
          [Locale.ChineseTW]: "設定伺服器。",
        })
        .addRoleOption((option) =>
          option
            .setName("staff_role")
            .setDescription("The role for staff members.")
            .setNameLocalizations({
              [Locale.ChineseTW]: "員工身分組",
            })
            .setDescriptionLocalizations({
              [Locale.ChineseTW]: "員工的身分組。",
            })
            .setRequired(true)
        )
        .addChannelOption((option) =>
          option
            .setName("ticket_category")
            .setDescription("The category for new tickets.")
            .setNameLocalizations({
              [Locale.ChineseTW]: "客服單類別",
            })
            .setDescriptionLocalizations({
              [Locale.ChineseTW]: "新客服單的類別。",
            })
            .setRequired(true)
        )
        .addChannelOption((option) =>
          option
            .setName("log_channel")
            .setDescription("The channel for logs.")
            .setNameLocalizations({
              [Locale.ChineseTW]: "日誌頻道",
            })
            .setDescriptionLocalizations({
              [Locale.ChineseTW]: "用於日誌的頻道。",
            })
            .setRequired(true)
        )
        .addChannelOption((option) =>
          option
            .setName("panel_channel")
            .setDescription("The channel for the ticket panel.")
            .setNameLocalizations({
              [Locale.ChineseTW]: "客服單面板頻道",
            })
            .setDescriptionLocalizations({
              [Locale.ChineseTW]: "客服單面板的頻道。",
            })
            .setRequired(true)
        )
        .addChannelOption((option) =>
          option
            .setName("archive_category")
            .setDescription("The category for archived tickets.")
            .setNameLocalizations({
              [Locale.ChineseTW]: "封存客服單類別",
            })
            .setDescriptionLocalizations({
              [Locale.ChineseTW]: "已封存客服單的類別。",
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
        .setName("view")
        .setDescription("View server settings.")
        .setNameLocalizations({
          [Locale.ChineseTW]: "檢視",
        })
        .setDescriptionLocalizations({
          [Locale.ChineseTW]: "檢視伺服器設定。",
        })
    )
    .addSubcommandGroup((group) =>
      group
        .setName("anti-spam")
        .setDescription("Configure anti-spam settings.")
        .setNameLocalizations({
          [Locale.ChineseTW]: "防洗版",
        })
        .setDescriptionLocalizations({
          [Locale.ChineseTW]: "設定防洗版功能。",
        })
        .addSubcommand((subcommand) =>
          subcommand
            .setName("set")
            .setDescription("Set anti-spam parameters.")
            .setNameLocalizations({
              [Locale.ChineseTW]: "設定",
            })
            .setDescriptionLocalizations({
              [Locale.ChineseTW]: "設定防洗版參數。",
            })
            .addIntegerOption((option) =>
              option
                .setName("threshold")
                .setDescription("Number of messages to trigger spam detection.")
                .setNameLocalizations({
                  [Locale.ChineseTW]: "閾值",
                })
                .setDescriptionLocalizations({
                  [Locale.ChineseTW]: "觸發偵測的訊息數量。",
                })
                .setRequired(true)
            )
            .addIntegerOption((option) =>
              option
                .setName("timeout")
                .setDescription("Duration of timeout in seconds.")
                .setNameLocalizations({
                  [Locale.ChineseTW]: "禁言時長",
                })
                .setDescriptionLocalizations({
                  [Locale.ChineseTW]: "禁言的持續時間（秒）。",
                })
                .setRequired(true)
            )
            .addIntegerOption((option) =>
              option
                .setName("time_window")
                .setDescription("Time window in seconds for spam detection.")
                .setNameLocalizations({
                  [Locale.ChineseTW]: "時間範圍",
                })
                .setDescriptionLocalizations({
                  [Locale.ChineseTW]: "偵測洗版的秒數範圍。",
                })
                .setRequired(true)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("show")
            .setDescription("Show current anti-spam settings.")
            .setNameLocalizations({
              [Locale.ChineseTW]: "顯示",
            })
            .setDescriptionLocalizations({
              [Locale.ChineseTW]: "顯示目前的防洗版設定。",
            })
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("reset")
            .setDescription("Reset anti-spam settings to default.")
            .setNameLocalizations({
              [Locale.ChineseTW]: "重設",
            })
            .setDescriptionLocalizations({
              [Locale.ChineseTW]: "將防洗版設定重設為預設值。",
            })
        )
    ),
  async execute(
    interaction: ChatInputCommandInteraction,
    client: Client,
    { settingsManager, localizationManager }: Services,
    _databases: Databases
  ) {
    if (!interaction.isChatInputCommand() || !interaction.guildId) return;

    const translations = getLocalizations(localizationManager, "config");
    const t = translations[interaction.locale] || translations["en-US"];
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const subcommand = interaction.options.getSubcommand();
    const subcommandGroup = interaction.options.getSubcommandGroup();

    if (subcommandGroup === "anti-spam") {
      if (subcommand === "set") {
        const threshold = interaction.options.getInteger("threshold", true);
        const timeout = interaction.options.getInteger("timeout", true);
        const timeWindow = interaction.options.getInteger("time_window", true);

        await upsertAntiSpamSettings({
          guildid: interaction.guildId,
          messagethreshold: threshold,
          time_window: timeWindow * 1000, // Convert to ms
          timeoutduration: timeout * 1000, // Convert to ms
        });

        flushAntiSpamSettingsForGuild(interaction.guildId);

        await interaction.editReply({
          content: `Anti-spam settings updated: Threshold=${threshold}, Time Window=${timeWindow}s, Timeout=${timeout}s.`,
        });
      } else if (subcommand === "show") {
        const settings = await getAntiSpamSettingsForGuild(interaction.guildId);
        if (settings) {
          await interaction.editReply({
            content: `Current anti-spam settings:\n- Threshold: ${
              settings.messagethreshold
            } messages\n- Time Window: ${
              settings.time_window / 1000
            } seconds\n- Timeout: ${settings.timeoutduration / 1000} seconds`,
          });
        } else {
          await interaction.editReply({
            content: "No custom anti-spam settings found for this server.",
          });
        }
      } else if (subcommand === "reset") {
        await deleteAntiSpamSettings(interaction.guildId);
        flushAntiSpamSettingsForGuild(interaction.guildId);
        await interaction.editReply({
          content: "Anti-spam settings have been reset to default.",
        });
      }
      return;
    }

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
