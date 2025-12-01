import {
  ChatInputCommandInteraction,
  Client,
  SlashCommandBuilder,
  PermissionFlagsBits,
  Locale,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  SectionBuilder,
  ThumbnailBuilder,
} from "discord.js";
import { Command, Databases, Services } from "../../../interfaces/Command";
import { MessageFlags } from "discord-api-types/v10";
import { getLocalizations } from "../../../utils/localization";
import {
  getAntiSpamLogChannel,
  setAntiSpamLogChannel,
  upsertAntiSpamSettings,
  deleteAntiSpamSettings,
} from "../../../repositories/admin.repository";
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
                .setRequired(false)
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
                .setRequired(false)
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
                .setRequired(false)
            )
            .addStringOption((option) =>
              option
                .setName("ignored_roles")
                .setDescription(
                  "Roles to ignore for spam detection (comma-separated IDs)."
                )
                .setNameLocalizations({
                  [Locale.ChineseTW]: "豁免身分組",
                })
                .setDescriptionLocalizations({
                  [Locale.ChineseTW]: "豁免偵測的身分組 (請用逗號分隔 ID)。",
                })
                .setRequired(false)
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
    
    // Only defer if not already deferred or replied
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }

    const subcommand = interaction.options.getSubcommand();
    const subcommandGroup = interaction.options.getSubcommandGroup();

    if (subcommandGroup === "anti-spam") {
      if (subcommand === "set") {
        const threshold = interaction.options.getInteger("threshold");
        const timeout = interaction.options.getInteger("timeout");
        const timeWindow = interaction.options.getInteger("time_window");
        const ignoredRolesStr = interaction.options.getString("ignored_roles");

        // Check if at least one option is provided
        if (threshold === null && timeout === null && timeWindow === null && ignoredRolesStr === null) {
          await interaction.editReply({
            content: "❌ 請至少提供一個參數來更新設定。\n" +
              "可用參數：`threshold`（閾值）、`timeout`（禁言時長）、`time_window`（時間範圍）、`ignored_roles`（豁免身分組）",
          });
          return;
        }

        // Get existing settings to merge with new values
        const existingSettings = await getAntiSpamSettingsForGuild(interaction.guildId);
        
        const updatedSettings: {
          guildid: string;
          messagethreshold?: number;
          time_window?: number;
          timeoutduration?: number;
          ignored_roles?: string[];
        } = {
          guildid: interaction.guildId,
        };

        // Only update fields that were provided
        if (threshold !== null) {
          updatedSettings.messagethreshold = threshold;
        } else if (existingSettings?.messagethreshold) {
          updatedSettings.messagethreshold = existingSettings.messagethreshold;
        }

        if (timeWindow !== null) {
          updatedSettings.time_window = timeWindow * 1000; // Convert to ms
        } else if (existingSettings?.time_window) {
          updatedSettings.time_window = existingSettings.time_window;
        }

        if (timeout !== null) {
          updatedSettings.timeoutduration = timeout * 1000; // Convert to ms
        } else if (existingSettings?.timeoutduration) {
          updatedSettings.timeoutduration = existingSettings.timeoutduration;
        }

        if (ignoredRolesStr !== null) {
          updatedSettings.ignored_roles = ignoredRolesStr
            .split(/[, ]+/)
            .filter((id) => /^\d+$/.test(id));
        } else if (existingSettings?.ignored_roles) {
          updatedSettings.ignored_roles = existingSettings.ignored_roles as string[];
        }

        await upsertAntiSpamSettings(updatedSettings);
        flushAntiSpamSettingsForGuild(interaction.guildId);

        // Build response message
        const updatedParts: string[] = [];
        if (threshold !== null) updatedParts.push(`閾值=${threshold}`);
        if (timeWindow !== null) updatedParts.push(`時間範圍=${timeWindow}秒`);
        if (timeout !== null) updatedParts.push(`禁言時長=${timeout}秒`);
        if (ignoredRolesStr !== null) {
          const roles = updatedSettings.ignored_roles || [];
          if (roles.length > 0) {
            updatedParts.push(`豁免身分組=${roles.map((id) => `<@&${id}>`).join(", ")}`);
          } else {
            updatedParts.push(`豁免身分組=無`);
          }
        }

        await interaction.editReply({
          content: `<:bck:1444901131825315850> 防洗版設定已更新：${updatedParts.join("、")}`,
        });
      } else if (subcommand === "show") {
        const settings = await getAntiSpamSettingsForGuild(interaction.guildId);
        const container = new ContainerBuilder().setAccentColor(0x5865f2);
        
        // Title section with thumbnail
        container.addSectionComponents(
          new SectionBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent("# <:sc:1444897142509670481> 防洗版設定\n*目前的防洗版設定*")
            )
            .setThumbnailAccessory(
              new ThumbnailBuilder().setURL(interaction.guild?.iconURL() || "https://cdn.discordapp.com/embed/avatars/0.png")
            )
        );
        
        container.addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
        );

        if (settings) {
          const ignoredRolesText = settings.ignored_roles &&
            Array.isArray(settings.ignored_roles) &&
            settings.ignored_roles.length > 0
              ? settings.ignored_roles.map((id: string) => `<@&${id}>`).join(", ")
              : "*無*";

          // Detection settings
          container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent("### <:pck:1444901376139202662> 偵測參數")
          );
          container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `-# 閾值\n**${settings.messagethreshold}** 則訊息\n` +
              `-# 時間範圍\n**${settings.time_window / 1000}** 秒`
            )
          );
          
          container.addSeparatorComponents(
            new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
          );
          
          // Punishment settings
          container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent("### <:st:1444900782372683786> 處罰設定")
          );
          container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `-# 禁言時長\n**${settings.timeoutduration / 1000}** 秒`
            )
          );
          
          container.addSeparatorComponents(
            new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
          );
          
          // Exemptions
          container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent("### <:st:1444900782372683786> 豁免身分組")
          );
          container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(ignoredRolesText)
          );

          await interaction.editReply({
            components: [container],
            flags: [MessageFlags.IsComponentsV2],
          });
        } else {
          container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent("### <:notice:1444897740566958111> 尚未設定")
          );
          container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "此伺服器尚未設定自訂防洗版參數，使用預設值。\n\n" +
              "使用 </config anti-spam show:1397608562225709100> 來自訂設定。"
            )
          );

          await interaction.editReply({
            components: [container],
            flags: [MessageFlags.IsComponentsV2],
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
      // Use English option names (as defined in SlashCommandBuilder)
      const staffRoleId = interaction.options.getRole("staff_role")?.id;
      const ticketCategoryId = interaction.options.getChannel("ticket_category")?.id;
      const logChannelId = interaction.options.getChannel("log_channel")?.id;
      const panelChannelId = interaction.options.getChannel("panel_channel")?.id;
      const archiveCategoryId = interaction.options.getChannel("archive_category")?.id;

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

      const container = new ContainerBuilder().setAccentColor(0x5865f2);

      // Title section with server thumbnail
      container.addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`# <:bow:1444897109336653886> ${t.subcommands.view.responses.title}\n*目前的伺服器設定*`)
          )
          .setThumbnailAccessory(
            new ThumbnailBuilder().setURL(interaction.guild?.iconURL() || "https://cdn.discordapp.com/embed/avatars/0.png")
          )
      );
      
      container.addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
      );

      if (settings) {
        // Ticket System Settings
        container.addTextDisplayComponents(
          new TextDisplayBuilder().setContent("### <:bh:1444897086763044976> 客服單系統")
        );
        container.addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `-# ${t.subcommands.view.responses.staff_role}\n<@&${settings.staffRoleId}>\n` +
            `-# ${t.subcommands.view.responses.ticket_category}\n<#${settings.ticketCategoryId}>\n` +
            `-# ${t.subcommands.view.responses.archive_category}\n<#${settings.archiveCategoryId}>`
          )
        );
        
        container.addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
        );
        
        // Channel Settings
        container.addTextDisplayComponents(
          new TextDisplayBuilder().setContent("### <:bc:1444896412042002533> 頻道設定")
        );
        container.addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `-# ${t.subcommands.view.responses.log_channel}\n<#${settings.logChannelId}>\n` +
            `-# ${t.subcommands.view.responses.panel_channel}\n<#${settings.panelChannelId}>`
          )
        );

        if (antiSpamLogChannel) {
          container.addSeparatorComponents(
            new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
          );
          container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent("### <:sc:1444897142509670481> 防洗版")
          );
          container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `-# 日誌頻道\n<#${antiSpamLogChannel}>`
            )
          );
        }
      } else {
        if (antiSpamLogChannel) {
          container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent("### <:sc:1444897142509670481> 防洗版")
          );
          container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `-# 日誌頻道\n<#${antiSpamLogChannel}>`
            )
          );
        } else {
          container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent("### <:notice:1444897740566958111> 尚未設定")
          );
          container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              t.subcommands.view.responses.no_config + "\n\n" +
              "使用 </config set:1397608562225709100> 來設定伺服器。"
            )
          );
        }
      }

      await interaction.editReply({
        components: [container],
        flags: [MessageFlags.IsComponentsV2],
      });
    }
  },
};
