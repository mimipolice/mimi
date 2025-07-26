import {
  EmbedBuilder,
  PermissionsBitField,
  Collection,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Message,
  GuildMember,
  TextChannel,
} from "discord.js";
import config from "../../config";
import logger from "../../utils/logger";
import { getAntiSpamLogChannel } from "../../shared/database/queries";
import { formatDistanceToNowStrict } from "date-fns"; // 推薦使用 date-fns 或類似庫來處理時間格式化

// --- 1. Types and Data Structures ---
// [優化] 使用 punishedUntil 取代 isNotified，記錄懲罰到期時間
interface UserMessageData {
  timestamps: { ts: number; channelId: string }[];
  punishedUntil: number | null;
}

const userMessageHistory = new Collection<string, UserMessageData>();
const { antiSpam } = config;
const TIMEOUT_DURATION_STRING = formatDistanceToNowStrict(
  antiSpam.timeoutDuration
);

// --- 2. Memory Management ---
// 這部分邏輯依然穩健，無需大改
setInterval(() => {
  const now = Date.now();
  let clearedCount = 0;
  userMessageHistory.forEach((data, userId) => {
    // 如果使用者仍在懲罰期，不清除
    if (data.punishedUntil && now < data.punishedUntil) {
      return;
    }
    const lastMessageTime = Math.max(
      ...(data.timestamps.map((t) => t.ts) || [0])
    );
    if (now - lastMessageTime > antiSpam.inactiveUserThreshold) {
      userMessageHistory.delete(userId);
      clearedCount++;
    }
  });
  if (clearedCount > 0) {
    logger.info(
      `[Anti-Spam Memory] Cleared ${clearedCount} inactive user(s) from cache.`
    );
  }
}, antiSpam.memoryCleanupInterval);

// --- 3. Spam Detection & Action Handler ---

// [優化] 將偵測邏輯抽離成獨立函式，提高可讀性和擴展性
function checkSpam(
  userData: UserMessageData,
  message: Message<true>
): string | null {
  const now = Date.now();
  const { timestamps } = userData;

  // 1. Single-channel spam check
  const singleChannelMessages = timestamps.filter(
    (ts) =>
      ts.channelId === message.channel.id && now - ts.ts < antiSpam.timeWindow
  );
  if (singleChannelMessages.length >= antiSpam.spamThreshold) {
    return "Fast single-channel spam";
  }

  // 2. Multi-channel spam check
  const multiChannelMessages = timestamps.filter(
    (ts) => now - ts.ts < antiSpam.multiChannelTimeWindow
  );
  const uniqueChannels = new Set(
    multiChannelMessages.map((ts) => ts.channelId)
  );
  if (
    uniqueChannels.size >= antiSpam.multiChannelSpamThreshold &&
    multiChannelMessages.length >= antiSpam.multiChannelSpamThreshold
  ) {
    return `Multi-channel spam (${uniqueChannels.size} channels)`;
  }

  // 未來可在此處增加更多偵測邏輯 (e.g., identical message spam)

  return null;
}

async function handleSpamAction(
  message: Message<true>,
  member: GuildMember,
  reason: string,
  userData: UserMessageData
) {
  const botMember = message.guild.members.me;
  if (
    !botMember?.permissions.has(PermissionsBitField.Flags.ModerateMembers) ||
    !member.moderatable
  ) {
    logger.error(
      `[Anti-Spam] Insufficient permissions or cannot moderate user ${member.id}.`
    );
    // 即使無法操作，也標記為已懲罰，避免在權限修復前反覆觸發
    userData.punishedUntil = Date.now() + antiSpam.timeoutDuration;
    return;
  }

  try {
    await member.timeout(antiSpam.timeoutDuration, reason);
    logger.info(
      `[Anti-Spam] Timed out user ${member.user.tag} (${member.id}). Reason: ${reason}`
    );
    await message.channel.send(
      `User ${member.toString()} has been timed out for ${TIMEOUT_DURATION_STRING} due to suspected spamming (${reason}).`
    );

    // [優化] 在成功懲罰後，設置懲罰到期時間
    userData.punishedUntil = Date.now() + antiSpam.timeoutDuration;
    // [優化] 懲罰後清空其訊息記錄，使其從「乾淨」的狀態重新開始
    userData.timestamps = [];
  } catch (err) {
    logger.error(`[Anti-Spam] Failed to time out user ${member.id}:`, err);
    return;
  }

  // --- Appeal Button ---
  const appealButton = new ButtonBuilder()
    .setCustomId(`appeal:${member.id}:${message.guild.id}`)
    .setLabel("I believe this is a mistake (Appeal)")
    .setStyle(ButtonStyle.Secondary)
    .setEmoji("😾");
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(appealButton);

  try {
    await member.send({
      content:
        `You have been timed out for **${TIMEOUT_DURATION_STRING}** in **${message.guild.name}** for suspected spamming.\n` + // [優化] 使用動態時間字串
        `**Reason**: ${reason}\n\n` +
        `If you believe this was a mistake, please click the button below to appeal to the administrators.`,
      components: [row],
    });
  } catch (dmError) {
    logger.warn(`[Anti-Spam] Could not DM user ${member.id}.`);
  }

  // --- Admin Notification ---
  // [優化] 為資料庫查詢和頻道操作增加錯誤處理
  try {
    const logChannelId = await getAntiSpamLogChannel(message.guild.id);
    if (!logChannelId) {
      await message.channel.send({
        content: `**[Anti-Spam System]** A user has been timed out, but no log channel is configured. An administrator can set one using the \`/config set anti_spam_log_channel\` command.`,
        allowedMentions: { users: [] },
      });
      logger.warn(
        `[Anti-Spam] No log channel configured for guild ${message.guild.id}.`
      );
      return;
    }

    const adminChannel = await message.client.channels.fetch(logChannelId);
    if (adminChannel instanceof TextChannel) {
      // 在 handleSpamAction 的 embed 建立部分
      const embed = new EmbedBuilder()
        .setTitle("🛡️ Automatic Timeout (Spam Detected)")
        .setColor("Red")
        .addFields(
          {
            name: "👤 User",
            value: `${member.toString()} (${member.id})`,
            inline: true,
          },
          {
            name: "🔗 Triggering Message",
            value: `[Click to view](${message.url})`,
            inline: true,
          },
          { name: "📜 Reason", value: reason, inline: false },
          {
            name: "🕒 Time",
            value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            inline: false,
          },
          { name: "⏳ Duration", value: TIMEOUT_DURATION_STRING, inline: true } // [優化] 使用動態時間字串
        )
        .setThumbnail(member.user.displayAvatarURL())
        .setFooter({ text: `Anti-Spam System | ${message.guild.name}` });
      await adminChannel.send({ embeds: [embed] });
    }
  } catch (adminNotifyError) {
    logger.error(
      `[Anti-Spam] Error during admin notification process:`,
      adminNotifyError
    );
  }

  // [優化] 移除原有的 userMessageHistory.delete(member.id) 和長 setTimeout
}

// --- 4. Main Exported Function ---
export async function handleAntiSpam(message: Message) {
  if (message.author.bot || !message.inGuild() || !message.member) return;

  if (
    antiSpam.ignoredUsers.includes(message.author.id) ||
    message.member.roles.cache.some((role) =>
      antiSpam.ignoredRoles.includes(role.id)
    )
  ) {
    return;
  }

  const now = Date.now();
  const userId = message.author.id;

  if (!userMessageHistory.has(userId)) {
    userMessageHistory.set(userId, { timestamps: [], punishedUntil: null });
  }
  const userData = userMessageHistory.get(userId)!;

  // [優化] 檢查使用者是否在懲罰期間
  if (userData.punishedUntil && now < userData.punishedUntil) {
    return;
  }
  // 如果懲罰已過期，重置狀態，讓他們可以被重新偵測
  if (userData.punishedUntil && now >= userData.punishedUntil) {
    userData.punishedUntil = null;
  }

  // --- Update Data ---
  const maxTimeWindow = Math.max(
    antiSpam.timeWindow,
    antiSpam.multiChannelTimeWindow
  );
  userData.timestamps = userData.timestamps.filter(
    (ts) => now - ts.ts < maxTimeWindow
  );
  userData.timestamps.push({ ts: now, channelId: message.channel.id });

  // --- Detection Logic ---
  const reason = checkSpam(userData, message);

  if (reason) {
    // 傳入 userData，以便在 handleSpamAction 中更新 punishedUntil
    await handleSpamAction(message, message.member, reason, userData);
  }
}
