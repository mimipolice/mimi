import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  Locale,
} from "discord.js";
import { Command, Services } from "../../../interfaces/Command";
import logger from "../../../utils/logger";
import { handleSubscribe } from "./subscribe";
import { handleUnsubscribe } from "./unsubscribe";
import { handleNotify } from "./notify";
import { handleEntry } from "./entry";
import { handleView } from "./view";
import { handlePermissions } from "./permissions";
import { handleFind } from "./find";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("sf")
    .setDescription("Story forum subscriptions and notifications")
    .setDescriptionLocalizations({
      [Locale.ChineseTW]: "故事論壇訂閱與通知系統",
    })
    .addSubcommand((subcommand) =>
      subcommand
        .setName("subscribe")
        .setDescription("Subscribe to story updates")
        .setDescriptionLocalizations({
          [Locale.ChineseTW]: "訂閱此故事的更新通知",
        })
        .addStringOption((option) =>
          option
            .setName("type")
            .setDescription("Subscription type (default: release)")
            .setNameLocalizations({
              [Locale.ChineseTW]: "類型",
            })
            .setDescriptionLocalizations({
              [Locale.ChineseTW]: "訂閱類型（預設：Release）",
            })
            .setRequired(false)
            .addChoices(
              { name: "Release（正式版）", value: "release" },
              { name: "Test（測試版）", value: "test" },
              { name: "關注作者（所有更新）", value: "author_all" }
            )
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("unsubscribe")
        .setDescription("Unsubscribe from story updates")
        .setDescriptionLocalizations({
          [Locale.ChineseTW]: "取消訂閱此故事的更新通知",
        })
        .addStringOption((option) =>
          option
            .setName("type")
            .setDescription("Subscription type to unsubscribe")
            .setNameLocalizations({
              [Locale.ChineseTW]: "類型",
            })
            .setDescriptionLocalizations({
              [Locale.ChineseTW]: "要取消的訂閱類型（不指定則取消全部）",
            })
            .setRequired(false)
            .addChoices(
              { name: "Release（正式版）", value: "release" },
              { name: "Test（測試版）", value: "test" },
              { name: "關注作者（所有更新）", value: "author_all" },
              { name: "全部取消", value: "all" }
            )
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("notify")
        .setDescription(
          "Send update notification to all subscribers (author/authorized only)"
        )
        .setDescriptionLocalizations({
          [Locale.ChineseTW]: "發送更新通知給訂閱者（需要權限）",
        })
        .addStringOption((option) =>
          option
            .setName("type")
            .setDescription("Update type")
            .setNameLocalizations({
              [Locale.ChineseTW]: "類型",
            })
            .setDescriptionLocalizations({
              [Locale.ChineseTW]: "更新類型（Release/Test）",
            })
            .setRequired(true)
            .addChoices(
              { name: "Release（正式版）", value: "release" },
              { name: "Test（測試版）", value: "test" }
            )
        )
        .addStringOption((option) =>
          option
            .setName("link")
            .setDescription("Message link to the update")
            .setNameLocalizations({
              [Locale.ChineseTW]: "連結",
            })
            .setDescriptionLocalizations({
              [Locale.ChineseTW]: "更新樓層的訊息連結",
            })
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("description")
            .setDescription("Brief description (optional, max 400 chars)")
            .setNameLocalizations({
              [Locale.ChineseTW]: "說明",
            })
            .setDescriptionLocalizations({
              [Locale.ChineseTW]: "簡短說明（選填，最多400字）",
            })
            .setRequired(false)
            .setMaxLength(400)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("entry")
        .setDescription("Create subscription entry for this thread")
        .setDescriptionLocalizations({
          [Locale.ChineseTW]: "為此帖子創建訂閱入口",
        })
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("view")
        .setDescription("View your subscription list")
        .setDescriptionLocalizations({
          [Locale.ChineseTW]: "查看你的訂閱列表",
        })
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("find")
        .setDescription("Find the subscription entry message in current thread")
        .setDescriptionLocalizations({
          [Locale.ChineseTW]: "尋找當前討論串的訂閱入口",
        })
    )
    .addSubcommandGroup((group) =>
      group
        .setName("permissions")
        .setDescription("Manage notification permissions (author only)")
        .setDescriptionLocalizations({
          [Locale.ChineseTW]: "管理推送權限（僅作者）",
        })
        .addSubcommand((subcommand) =>
          subcommand
            .setName("add")
            .setDescription("Grant notification permission to a user")
            .setDescriptionLocalizations({
              [Locale.ChineseTW]: "授予用戶推送權限",
            })
            .addUserOption((option) =>
              option
                .setName("user")
                .setDescription("User to grant permission")
                .setNameLocalizations({
                  [Locale.ChineseTW]: "用戶",
                })
                .setDescriptionLocalizations({
                  [Locale.ChineseTW]: "要授權的用戶",
                })
                .setRequired(true)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("remove")
            .setDescription("Remove notification permission from a user")
            .setDescriptionLocalizations({
              [Locale.ChineseTW]: "移除用戶的推送權限",
            })
            .addUserOption((option) =>
              option
                .setName("user")
                .setDescription("User to remove permission")
                .setNameLocalizations({
                  [Locale.ChineseTW]: "用戶",
                })
                .setDescriptionLocalizations({
                  [Locale.ChineseTW]: "要移除權限的用戶",
                })
                .setRequired(true)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("list")
            .setDescription("List all users with notification permission")
            .setDescriptionLocalizations({
              [Locale.ChineseTW]: "查看所有擁有權限的用戶",
            })
        )
    ),
  guildOnly: true,
  async execute(
    interaction: ChatInputCommandInteraction,
    client: Client,
    services: Services
  ) {
    // Only defer if not already deferred or replied
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true });
    }

    try {
      const subcommandGroup = interaction.options.getSubcommandGroup(false);
      const subcommand = interaction.options.getSubcommand();

      // Handle view command (doesn't require thread check)
      if (subcommand === "view") {
        await handleView(interaction, client, services);
        return;
      }

      // Check if in a thread for all other commands
      if (!interaction.channel?.isThread()) {
        await interaction.editReply({
          content: "❌ 此指令只能在討論串中使用。",
        });
        return;
      }

      // Check if it's a story forum thread
      const threadInfo = await services.storyForumService.getThreadInfo(
        interaction.channel.id
      );

      if (!threadInfo || threadInfo.status !== "validated") {
        await interaction.editReply({
          content: "❌ 此討論串不是已驗證的故事論壇討論串。",
        });
        return;
      }

      // Route to appropriate handler
      if (subcommand === "subscribe") {
        await handleSubscribe(interaction, client, services);
      } else if (subcommand === "unsubscribe") {
        await handleUnsubscribe(interaction, client, services);
      } else if (subcommand === "notify") {
        await handleNotify(interaction, client, services);
      } else if (subcommand === "entry") {
        await handleEntry(interaction, client, services, threadInfo);
      } else if (subcommand === "find") {
        await handleFind(interaction, client, services);
      } else if (subcommandGroup === "permissions") {
        await handlePermissions(interaction, client, services, threadInfo);
      }
    } catch (error) {
      logger.error("[Story] Error executing command:", error);
      await interaction.editReply({
        content: "❌ 執行指令時發生錯誤。",
      });
    }
  },
};
