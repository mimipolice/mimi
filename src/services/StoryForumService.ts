import {
  ThreadChannel,
  Message,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
  Client,
} from "discord.js";
import { Kysely } from "kysely";
import { MimiDLCDB } from "../shared/database/types";
import config from "../config";
import logger from "../utils/logger";

const VALIDATION_TIMEOUT_MS = 5 * 60 * 1000; // 5 分鐘
const REQUIRED_SECTIONS = [
  "# 你的故事標題",
  "# 故事的開場白",
  "# 你的第一個行動（你的第一段話）",
];

export class StoryForumService {
  private validationTimers: Map<string, NodeJS.Timeout> = new Map();
  private hintCooldowns: Map<string, number> = new Map();

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
        status: "pending",
      })
      .onConflict((oc) => oc.doNothing())
      .execute();

    // Set a timeout for the thread
    if (this.validationTimers.has(thread.id)) {
      clearTimeout(this.validationTimers.get(thread.id)!);
    }
    const timer = setTimeout(() => {
      this.timeoutValidation(thread.id);
    }, VALIDATION_TIMEOUT_MS);
    this.validationTimers.set(thread.id, timer);

    // Check the format shortly after creation to ensure the starter message is available
    // and to avoid race conditions with the messageCreate event.
    setTimeout(() => {
      if (thread.ownerId) {
        this.checkThreadFormat(thread, thread.ownerId).catch((err) => {
          logger.error(
            `[StoryForum] Error during initial format check for thread ${thread.id}`,
            err
          );
        });
      }
    }, 2000); // 2-second delay
  }

  private async timeoutValidation(threadId: string): Promise<void> {
    this.validationTimers.delete(threadId);
    const threadInfo = await this.db
      .selectFrom("story_forum_threads")
      .selectAll()
      .where("thread_id", "=", threadId)
      .executeTakeFirst();

    if (threadInfo && threadInfo.status === "pending") {
      logger.info(`[StoryForum] Thread ${threadId} timed out. Deleting.`);
      const thread = (await this.client.channels
        .fetch(threadId)
        .catch(() => null)) as ThreadChannel | null;
      if (thread) {
        const messages = await thread.messages.fetch({ limit: 100 });
        const authorMessages = messages.filter(
          (m) => m.author.id === threadInfo.author_id
        );
        const starterMessage = await thread
          .fetchStarterMessage()
          .catch(() => null);
        if (starterMessage && !authorMessages.has(starterMessage.id)) {
          authorMessages.set(starterMessage.id, starterMessage);
        }
        const fullContent = [...authorMessages.values()]
          .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
          .map((m) => m.content)
          .join("\n\n");

        const contentTrimmed = fullContent.trim();
        const missingSections = REQUIRED_SECTIONS.filter(
          (section) => !contentTrimmed.includes(section)
        );

        let reason = "您的投稿在時間內未完成格式，已被自動移除。";
        if (missingSections.length > 0) {
          reason = `您的投稿缺少以下部分，已被自動移除：\n- ${missingSections.join(
            "\n- "
          )}`;
        }

        await this.rejectPost(
          thread,
          threadInfo.author_id,
          fullContent,
          reason
        );
      } else {
        await this.db
          .deleteFrom("story_forum_threads")
          .where("thread_id", "=", threadId)
          .execute();
      }
    }
  }

  public async validateMessage(message: Message): Promise<void> {
    if (
      !message.guild ||
      !message.channel.isThread() ||
      message.guild.id !== config.discord.guildId
    )
      return;

    const threadInfo = await this.db
      .selectFrom("story_forum_threads")
      .selectAll()
      .where("thread_id", "=", message.channel.id)
      .executeTakeFirst();

    if (
      !threadInfo ||
      threadInfo.status !== "pending" ||
      message.author.id !== threadInfo.author_id
    ) {
      return;
    }

    logger.info(
      `[StoryForum] Validating message in thread: ${message.channel.id}`
    );
    await this.checkThreadFormat(
      message.channel as ThreadChannel,
      threadInfo.author_id
    );
  }

  private async checkThreadFormat(
    thread: ThreadChannel,
    authorId: string
  ): Promise<void> {
    const messages = await thread.messages.fetch({ limit: 100 });
    const authorMessages = messages.filter((m) => m.author.id === authorId);
    const starterMessage = await thread.fetchStarterMessage().catch(() => null);
    if (starterMessage && !authorMessages.has(starterMessage.id)) {
      authorMessages.set(starterMessage.id, starterMessage);
    }

    const fullContent = [...authorMessages.values()]
      .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
      .map((m) => m.content)
      .join("\n\n");

    const contentTrimmed = fullContent.trim();
    const missingSections = REQUIRED_SECTIONS.filter(
      (section) => !contentTrimmed.includes(section)
    );

    if (missingSections.length > 0) {
      logger.debug(
        `[StoryForum] Thread ${
          thread.id
        } is still missing sections: ${missingSections.join(", ")}`
      );
      await this.sendFormatHint(thread, missingSections);
      return;
    }

    logger.info(
      `[StoryForum] Thread ${thread.id} format is correct. Approving post.`
    );
    await this.approvePost(thread, authorId);
  }

  private async sendFormatHint(
    thread: ThreadChannel,
    missingSections: string[]
  ): Promise<void> {
    const now = Date.now();
    const lastHint = this.hintCooldowns.get(thread.id);
    const cooldown = 30 * 1000; // 30 秒冷卻

    if (lastHint && now - lastHint < cooldown) {
      logger.debug(`[StoryForum] Hint for thread ${thread.id} is on cooldown.`);
      return;
    }

    const hintMessage = `你的故事似乎還缺少以下部分，請繼續完成：\n- ${missingSections.join(
      "\n- "
    )}`;

    await thread.send(hintMessage);
    this.hintCooldowns.set(thread.id, now);
  }

  private async approvePost(
    thread: ThreadChannel,
    authorId: string
  ): Promise<void> {
    logger.info(
      `[StoryForum] Post approved (pending user confirmation) for thread: ${thread.id}`
    );

    if (this.validationTimers.has(thread.id)) {
      clearTimeout(this.validationTimers.get(thread.id)!);
      this.validationTimers.delete(thread.id);
    }

    await this.db
      .updateTable("story_forum_threads")
      .set({ status: "validated" })
      .where("thread_id", "=", thread.id)
      .execute();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`story_confirm:${thread.id}:${authorId}`)
        .setLabel("確認投稿")
        .setStyle(ButtonStyle.Success)
    );
    await thread.send({
      content: `<@${authorId}>, 你的故事格式正確！請確認這是否為你的完整投稿內容，確認後將鎖定格式檢查，開放自由討論。`,
      components: [row],
    });
  }

  private async rejectPost(
    thread: ThreadChannel,
    authorId: string,
    content: string,
    reason: string
  ): Promise<void> {
    logger.warn(
      `[StoryForum] Post rejected for thread ${thread.id}. Reason: ${reason}`
    );
    const author = await this.client.users.fetch(authorId).catch(() => null);
    if (author) {
      const formatTemplate = `
請依照以下格式發布你的故事：
\`\`\`
# 你的故事標題
(你的標題內容)

# 世界觀與角色設定（選填）
(你的設定內容)

# 故事的開場白
(你的開場白內容)

# 你的第一個行動（你的第一段話）
(你的第一段行動)
\`\`\`
`;
      const rejectionMessage = `你的故事 **${
        thread.name
      }** 因以下原因被退回：\n- ${reason}\n\n${formatTemplate}${
        content ? "\n**你原本的投稿內容如下：**" : ""
      }`;

      try {
        if (content && rejectionMessage.length + content.length > 1990) {
          const attachment = new AttachmentBuilder(
            Buffer.from(content, "utf-8"),
            { name: "your_story_submission.txt" }
          );
          await author.send({ content: rejectionMessage, files: [attachment] });
        } else {
          await author.send(
            `${rejectionMessage}${
              content ? `\n\`\`\`\n${content}\n\`\`\`` : ""
            }`
          );
        }
      } catch (error) {
        logger.error(
          `[StoryForum] Failed to DM user ${authorId}. Sending public notice.`
        );
        await thread.send(
          `<@${authorId}>, 你的投稿格式不符或已逾時，但我無法私訊你。請檢查你的隱私設定後重新投稿。`
        );
        await new Promise((resolve) => setTimeout(resolve, 10000));
      }
    }

    await thread
      .delete("不符合故事論壇格式或已逾時")
      .catch((err) =>
        logger.error(`Failed to delete thread ${thread.id}`, err)
      );
    await this.db
      .deleteFrom("story_forum_threads")
      .where("thread_id", "=", thread.id)
      .execute();
  }

  public async confirmSubmission(threadId: string): Promise<void> {
    logger.info(
      `[StoryForum] User confirmed submission for thread: ${threadId}`
    );

    const thread = (await this.client.channels
      .fetch(threadId)
      .catch(() => null)) as ThreadChannel | null;

    if (thread) {
      const messages = await thread.messages.fetch({ limit: 100 });
      const hintMessages = messages.filter(
        (m) =>
          m.author.id === this.client.user?.id &&
          m.content.includes("你的故事似乎還缺少以下部分")
      );

      for (const message of hintMessages.values()) {
        await message.delete().catch((err) => {
          logger.error(
            `[StoryForum] Failed to delete hint message ${message.id} in thread ${threadId}`,
            err
          );
        });
      }
    }
  }

  public async getThreadInfo(threadId: string) {
    return this.db
      .selectFrom("story_forum_threads")
      .selectAll()
      .where("thread_id", "=", threadId)
      .executeTakeFirst();
  }
}
