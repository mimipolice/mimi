import {
  ThreadChannel,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
} from "discord.js";
import { Kysely } from "kysely";
import { MimiDLCDB } from "../shared/database/types";
import config from "../config";
import logger from "../utils/logger";

export class StoryForumService {
  constructor(private db: Kysely<MimiDLCDB>, private client: Client) {}

  public async registerThread(thread: ThreadChannel): Promise<void> {
    if (thread.guild.id !== config.discord.guildId) return;

    logger.info(`[StoryForum] Registering new story thread: ${thread.id}`);
    await this.db
      .insertInto("story_forum_threads")
      .values({
        thread_id: thread.id,
        guild_id: thread.guild.id,
        author_id: thread.ownerId!,
        status: "validated",
      })
      .onConflict((oc) => oc.doNothing())
      .execute();
  }

  public async getThreadInfo(threadId: string) {
    return this.db
      .selectFrom("story_forum_threads")
      .selectAll()
      .where("thread_id", "=", threadId)
      .executeTakeFirst();
  }

  public async subscribeToThread(
    threadId: string,
    userId: string,
    subscriptionType: "release" | "test" | "author_all" = "release"
  ): Promise<boolean> {
    try {
      const threadInfo = await this.getThreadInfo(threadId);
      if (!threadInfo || threadInfo.status !== "validated") {
        return false;
      }

      await this.db
        .insertInto("story_forum_subscriptions")
        .values({
          thread_id: threadId,
          user_id: userId,
          subscription_type: subscriptionType,
        })
        .onConflict((oc) => oc.doNothing())
        .execute();

      logger.info(
        `[StoryForum] User ${userId} subscribed to thread ${threadId} with type ${subscriptionType}`
      );
      return true;
    } catch (error) {
      logger.error(
        `[StoryForum] Error subscribing user ${userId} to thread ${threadId}`,
        error
      );
      return false;
    }
  }

  public async unsubscribeFromThread(
    threadId: string,
    userId: string,
    subscriptionType?: "release" | "test" | "author_all"
  ): Promise<boolean> {
    try {
      let query = this.db
        .deleteFrom("story_forum_subscriptions")
        .where("thread_id", "=", threadId)
        .where("user_id", "=", userId);

      if (subscriptionType) {
        query = query.where("subscription_type", "=", subscriptionType);
      }

      const result = await query.executeTakeFirst();

      logger.info(
        `[StoryForum] User ${userId} unsubscribed from thread ${threadId}${
          subscriptionType ? ` (type: ${subscriptionType})` : ""
        }`
      );
      return result.numDeletedRows > 0n;
    } catch (error) {
      logger.error(
        `[StoryForum] Error unsubscribing user ${userId} from thread ${threadId}`,
        error
      );
      return false;
    }
  }

  public async getThreadSubscribers(
    threadId: string,
    subscriptionType?: "release" | "test" | "author_all"
  ): Promise<string[]> {
    try {
      let query = this.db
        .selectFrom("story_forum_subscriptions")
        .select("user_id")
        .where("thread_id", "=", threadId);

      if (subscriptionType) {
        query = query.where("subscription_type", "=", subscriptionType);
      }

      const subscribers = await query.execute();
      return [...new Set(subscribers.map((s) => s.user_id))];
    } catch (error) {
      logger.error(
        `[StoryForum] Error getting subscribers for thread ${threadId}`,
        error
      );
      return [];
    }
  }

  public async isUserSubscribed(
    threadId: string,
    userId: string,
    subscriptionType?: "release" | "test" | "author_all"
  ): Promise<boolean> {
    try {
      let query = this.db
        .selectFrom("story_forum_subscriptions")
        .selectAll()
        .where("thread_id", "=", threadId)
        .where("user_id", "=", userId);

      if (subscriptionType) {
        query = query.where("subscription_type", "=", subscriptionType);
      }

      const subscription = await query.executeTakeFirst();
      return !!subscription;
    } catch (error) {
      logger.error(
        `[StoryForum] Error checking subscription for user ${userId} in thread ${threadId}`,
        error
      );
      return false;
    }
  }

  public async getUserSubscriptions(
    threadId: string,
    userId: string
  ): Promise<Array<"release" | "test" | "author_all">> {
    try {
      const subscriptions = await this.db
        .selectFrom("story_forum_subscriptions")
        .select("subscription_type")
        .where("thread_id", "=", threadId)
        .where("user_id", "=", userId)
        .execute();

      return subscriptions.map((s) => s.subscription_type);
    } catch (error) {
      logger.error(
        `[StoryForum] Error getting user subscriptions for user ${userId} in thread ${threadId}`,
        error
      );
      return [];
    }
  }

  public async getAllUserSubscriptions(userId: string) {
    try {
      const subscriptions = await this.db
        .selectFrom("story_forum_subscriptions")
        .selectAll()
        .where("user_id", "=", userId)
        .execute();

      return subscriptions;
    } catch (error) {
      logger.error(
        `[StoryForum] Error getting all subscriptions for user ${userId}`,
        error
      );
      return [];
    }
  }

  public async notifySubscribers(
    thread: ThreadChannel,
    authorId: string,
    updateType: "release" | "test",
    messageLink: string,
    description?: string
  ): Promise<number> {
    try {
      const subscribers = await this.getThreadSubscribers(thread.id, updateType);
      const authorAllSubscribers = await this.getThreadSubscribers(
        thread.id,
        "author_all"
      );
      const allSubscribers = [
        ...new Set([...subscribers, ...authorAllSubscribers]),
      ];
      const subscribersToNotify = allSubscribers.filter((id) => id !== authorId);

      if (subscribersToNotify.length === 0) {
        return 0;
      }

      const mentions = subscribersToNotify.map((id) => `<@${id}>`).join(" ");
      const typeEmoji = updateType === "release" ? "🎉" : "🧪";
      const typeName = updateType === "release" ? "正式版" : "測試版";
      
      let notificationMessage = `${mentions}\n\n${typeEmoji} **${typeName}更新通知**\n`;
      notificationMessage += `📍 [查看更新內容](${messageLink})`;
      
      if (description) {
        notificationMessage += `\n\n${description}`;
      }

      await thread.send(notificationMessage);

      // 更新最後更新連結
      await this.updateLastUpdate(thread.id, updateType, messageLink);

      logger.info(
        `[StoryForum] Notified ${subscribersToNotify.length} subscribers in thread ${thread.id} for ${updateType} update`
      );
      return subscribersToNotify.length;
    } catch (error) {
      logger.error(
        `[StoryForum] Error notifying subscribers in thread ${thread.id}`,
        error
      );
      return 0;
    }
  }

  public async getSubscriberCount(
    threadId: string,
    subscriptionType?: "release" | "test" | "author_all"
  ): Promise<number> {
    try {
      let query = this.db
        .selectFrom("story_forum_subscriptions")
        .select((eb) => eb.fn.countAll().as("count"))
        .where("thread_id", "=", threadId);

      if (subscriptionType) {
        query = query.where("subscription_type", "=", subscriptionType);
      }

      const result = await query.executeTakeFirst();
      return Number(result?.count || 0);
    } catch (error) {
      logger.error(
        `[StoryForum] Error getting subscriber count for thread ${threadId}`,
        error
      );
      return 0;
    }
  }

  // 訂閱入口管理
  public async createSubscriptionEntry(threadId: string): Promise<boolean> {
    try {
      await this.db
        .insertInto("story_forum_subscription_entries")
        .values({
          thread_id: threadId,
          enabled: true,
        })
        .onConflict((oc) => oc.doNothing())
        .execute();

      logger.info(
        `[StoryForum] Created subscription entry for thread ${threadId}`
      );
      return true;
    } catch (error) {
      logger.error(
        `[StoryForum] Error creating subscription entry for thread ${threadId}`,
        error
      );
      return false;
    }
  }

  public async sendSubscriptionEntryMessage(threadId: string): Promise<boolean> {
    try {
      const thread = await this.client.channels.fetch(threadId);
      if (!thread?.isThread()) {
        logger.error(`[StoryForum] Channel ${threadId} is not a thread`);
        return false;
      }

      // Get current statistics and entry info
      const entry = await this.getSubscriptionEntry(threadId);
      const releaseCount = await this.getSubscriberCount(threadId, "release");
      const testCount = await this.getSubscriberCount(threadId, "test");
      const authorAllCount = await this.getSubscriberCount(threadId, "author_all");

      // Build embed
      const embed = new EmbedBuilder()
        .setTitle("📚 故事訂閱入口")
        .setDescription(
          "點擊下方按鈕訂閱此故事的更新通知！\n\n" +
          "**訂閱類型說明：**\n" +
          "• **Release（正式版）**: 只接收正式發布的更新\n" +
          "• **Test（測試版）**: 只接收測試版本的更新\n" +
          "• **關注作者**: 接收作者的所有更新（包含 Release 和 Test）"
        )
        .setColor(0x5865f2)
        .addFields(
          {
            name: "📊 訂閱統計",
            value: `• Release: **${releaseCount}** 人\n• Test: **${testCount}** 人\n• 關注作者: **${authorAllCount}** 人`,
            inline: false,
          }
        );

      // Add last update info if available
      if (entry?.last_release_update || entry?.last_test_update) {
        let lastUpdateText = "";
        if (entry.last_release_update) {
          lastUpdateText += `• Release: ${entry.last_release_update}\n`;
        }
        if (entry.last_test_update) {
          lastUpdateText += `• Test: ${entry.last_test_update}`;
        }
        embed.addFields({
          name: "📍 最後更新",
          value: lastUpdateText,
          inline: false,
        });
      }

      // Build buttons
      const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`story_subscribe:${threadId}:release`)
          .setLabel("訂閱 Release")
          .setEmoji("🎉")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`story_subscribe:${threadId}:test`)
          .setLabel("訂閱 Test")
          .setEmoji("🧪")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`story_subscribe:${threadId}:author_all`)
          .setLabel("關注作者")
          .setEmoji("⭐")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`story_unsubscribe:${threadId}`)
          .setLabel("取消訂閱")
          .setEmoji("🔕")
          .setStyle(ButtonStyle.Danger)
      );

      const messagePayload = {
        embeds: [embed],
        components: [buttons],
      };

      // Check if we should edit existing message or send new one
      if (entry?.message_id) {
        try {
          const message = await thread.messages.fetch(entry.message_id);
          await message.edit(messagePayload);
          logger.info(
            `[StoryForum] Updated subscription entry message for thread ${threadId}`
          );
          return true;
        } catch (error) {
          logger.warn(
            `[StoryForum] Could not edit message ${entry.message_id}, will send new one`,
            error
          );
          // Fall through to send new message
        }
      }

      // Send new message and save its ID
      const message = await thread.send(messagePayload);
      
      // Update database with message ID
      await this.db
        .updateTable("story_forum_subscription_entries")
        .set({ message_id: message.id })
        .where("thread_id", "=", threadId)
        .execute();

      logger.info(
        `[StoryForum] Sent subscription entry message for thread ${threadId}`
      );
      return true;
    } catch (error) {
      logger.error(
        `[StoryForum] Error sending subscription entry message for thread ${threadId}`,
        error
      );
      return false;
    }
  }

  public async hasSubscriptionEntry(threadId: string): Promise<boolean> {
    try {
      const entry = await this.db
        .selectFrom("story_forum_subscription_entries")
        .selectAll()
        .where("thread_id", "=", threadId)
        .executeTakeFirst();

      return !!entry && entry.enabled;
    } catch (error) {
      logger.error(
        `[StoryForum] Error checking subscription entry for thread ${threadId}`,
        error
      );
      return false;
    }
  }

  public async getSubscriptionEntry(threadId: string) {
    try {
      return await this.db
        .selectFrom("story_forum_subscription_entries")
        .selectAll()
        .where("thread_id", "=", threadId)
        .executeTakeFirst();
    } catch (error) {
      logger.error(
        `[StoryForum] Error getting subscription entry for thread ${threadId}`,
        error
      );
      return null;
    }
  }

  private async updateLastUpdate(
    threadId: string,
    updateType: "release" | "test",
    messageLink: string
  ): Promise<void> {
    try {
      const column =
        updateType === "release" ? "last_release_update" : "last_test_update";

      await this.db
        .updateTable("story_forum_subscription_entries")
        .set({ [column]: messageLink })
        .where("thread_id", "=", threadId)
        .execute();
    } catch (error) {
      logger.error(
        `[StoryForum] Error updating last update for thread ${threadId}`,
        error
      );
    }
  }

  // 權限管理
  public async addPermission(
    threadId: string,
    userId: string,
    grantedBy: string
  ): Promise<boolean> {
    try {
      // 檢查權限數量（包括作者）
      const permissionCount = await this.getPermissionCount(threadId);
      if (permissionCount >= 5) {
        return false;
      }

      await this.db
        .insertInto("story_forum_permissions")
        .values({
          thread_id: threadId,
          user_id: userId,
          granted_by: grantedBy,
        })
        .onConflict((oc) => oc.doNothing())
        .execute();

      logger.info(
        `[StoryForum] Added permission for user ${userId} in thread ${threadId}`
      );
      return true;
    } catch (error) {
      logger.error(
        `[StoryForum] Error adding permission for user ${userId} in thread ${threadId}`,
        error
      );
      return false;
    }
  }

  public async removePermission(
    threadId: string,
    userId: string
  ): Promise<boolean> {
    try {
      const result = await this.db
        .deleteFrom("story_forum_permissions")
        .where("thread_id", "=", threadId)
        .where("user_id", "=", userId)
        .executeTakeFirst();

      logger.info(
        `[StoryForum] Removed permission for user ${userId} in thread ${threadId}`
      );
      return result.numDeletedRows > 0n;
    } catch (error) {
      logger.error(
        `[StoryForum] Error removing permission for user ${userId} in thread ${threadId}`,
        error
      );
      return false;
    }
  }

  public async hasPermission(threadId: string, userId: string): Promise<boolean> {
    try {
      // 檢查是否為作者
      const threadInfo = await this.getThreadInfo(threadId);
      if (threadInfo?.author_id === userId) {
        return true;
      }

      // 檢查是否有權限
      const permission = await this.db
        .selectFrom("story_forum_permissions")
        .selectAll()
        .where("thread_id", "=", threadId)
        .where("user_id", "=", userId)
        .executeTakeFirst();

      return !!permission;
    } catch (error) {
      logger.error(
        `[StoryForum] Error checking permission for user ${userId} in thread ${threadId}`,
        error
      );
      return false;
    }
  }

  public async getPermissions(threadId: string): Promise<string[]> {
    try {
      const permissions = await this.db
        .selectFrom("story_forum_permissions")
        .select("user_id")
        .where("thread_id", "=", threadId)
        .execute();

      return permissions.map((p) => p.user_id);
    } catch (error) {
      logger.error(
        `[StoryForum] Error getting permissions for thread ${threadId}`,
        error
      );
      return [];
    }
  }

  public async getPermissionCount(threadId: string): Promise<number> {
    try {
      const threadInfo = await this.getThreadInfo(threadId);
      const permissionResult = await this.db
        .selectFrom("story_forum_permissions")
        .select((eb) => eb.fn.countAll().as("count"))
        .where("thread_id", "=", threadId)
        .executeTakeFirst();

      // 作者算一個 + 其他權限持有者
      return 1 + Number(permissionResult?.count || 0);
    } catch (error) {
      logger.error(
        `[StoryForum] Error getting permission count for thread ${threadId}`,
        error
      );
      return 1; // 至少有作者
    }
  }

  // 作者偏好管理
  public async getAuthorPreference(userId: string): Promise<boolean> {
    try {
      const preference = await this.db
        .selectFrom("story_forum_author_preferences")
        .select("ask_on_post")
        .where("user_id", "=", userId)
        .executeTakeFirst();

      return preference?.ask_on_post ?? true; // 默認為詢問
    } catch (error) {
      logger.error(
        `[StoryForum] Error getting author preference for user ${userId}`,
        error
      );
      return true;
    }
  }

  public async setAuthorPreference(
    userId: string,
    askOnPost: boolean
  ): Promise<boolean> {
    try {
      await this.db
        .insertInto("story_forum_author_preferences")
        .values({
          user_id: userId,
          ask_on_post: askOnPost,
        })
        .onConflict((oc) =>
          oc.column("user_id").doUpdateSet({
            ask_on_post: askOnPost,
            updated_at: new Date().toISOString(),
          })
        )
        .execute();

      logger.info(
        `[StoryForum] Updated author preference for user ${userId}: ${askOnPost}`
      );
      return true;
    } catch (error) {
      logger.error(
        `[StoryForum] Error setting author preference for user ${userId}`,
        error
      );
      return false;
    }
  }

  // 詢問作者是否要創建訂閱入口
  public async askAboutSubscriptionEntry(
    thread: ThreadChannel,
    authorId: string
  ): Promise<void> {
    try {
      const embed = new EmbedBuilder()
        .setTitle("📢 是否要創建「更新推流」功能？")
        .setDescription(
          "這個功能可以讓讀者訂閱你的故事更新通知，當你發布新內容時可以一鍵通知所有訂閱者。\n\n" +
          "**功能說明：**\n" +
          "• 讀者可以訂閱 Release（正式版）或 Test（測試版）\n" +
          "• 你更新後使用 `/sf notify` 通知訂閱者\n" +
          "• 可以附上更新樓層連結和簡短說明\n\n" +
          "**選項說明：**\n" +
          "• **是**：立即創建訂閱入口\n" +
          "• **否**：這次不創建，但下次發帖還會詢問\n" +
          "• **不再提醒**：以後都不問，但可以手動使用 `/sf entry`"+
          "詳細說明：https://discord.com/channels/812574421465956373/1375057486721060904/1439558143540465725"
        )
        .setColor(0x5865f2)
        .setFooter({ text: "提示：如果你不確定，可以選「否」，之後再決定" });

      const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`story_entry_yes:${thread.id}:${authorId}`)
          .setLabel("是")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`story_entry_no:${thread.id}:${authorId}`)
          .setLabel("否")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`story_entry_never:${thread.id}:${authorId}`)
          .setLabel("不再提醒")
          .setStyle(ButtonStyle.Danger)
      );

      await thread.send({
        content: `<@${authorId}>`,
        embeds: [embed],
        components: [buttons],
      });

      logger.info(
        `[StoryForum] Asked author ${authorId} about subscription entry for thread ${thread.id}`
      );
    } catch (error) {
      logger.error(
        `[StoryForum] Error asking about subscription entry for thread ${thread.id}`,
        error
      );
    }
  }
}
