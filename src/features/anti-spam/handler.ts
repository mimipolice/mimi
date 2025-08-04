import {
  EmbedBuilder,
  PermissionsBitField,
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
import { getAntiSpamSettingsForGuild } from "../../shared/cache";
import { formatDistanceStrict } from "date-fns";

import redisClient from "../../shared/redis";

const antiSpamCache = redisClient;

interface UserMessageData {
  timestamps: { ts: number; channelId: string }[];
  punishedUntil: number | null;
}

// --- 3. Spam Detection & Action Handler ---

// [優化] 將偵測邏輯抽離成獨立函式，提高可讀性和擴展性
function checkSpam(
  userData: UserMessageData,
  message: Message<true>,
  settings: {
    spamThreshold: number;
    timeWindow: number;
    multiChannelSpamThreshold: number;
    multiChannelTimeWindow: number;
  }
): string | null {
  const now = Date.now();
  const { timestamps } = userData;

  // 1. Single-channel spam check
  const singleChannelMessages = timestamps.filter(
    (ts) =>
      ts.channelId === message.channel.id && now - ts.ts < settings.timeWindow
  );
  if (singleChannelMessages.length >= settings.spamThreshold) {
    return "Fast single-channel spam";
  }

  // 2. Multi-channel spam check
  const multiChannelMessages = timestamps.filter(
    (ts) => now - ts.ts < settings.multiChannelTimeWindow
  );
  const uniqueChannels = new Set(
    multiChannelMessages.map((ts) => ts.channelId)
  );
  if (
    uniqueChannels.size >= settings.multiChannelSpamThreshold &&
    multiChannelMessages.length >= settings.multiChannelSpamThreshold
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
  userData: UserMessageData,
  timeoutDuration: number
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
    userData.punishedUntil = Date.now() + timeoutDuration;
    return;
  }

  const timeoutDurationString = formatDistanceStrict(0, timeoutDuration);

  try {
    await member.timeout(timeoutDuration, reason);
    logger.info(
      `[Anti-Spam] Timed out user ${member.user.tag} (${member.id}). Reason: ${reason}`
    );
    await message.channel.send(
      `User ${member.toString()} has been timed out for ${timeoutDurationString} due to suspected spamming (${reason}).`
    );

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
        `You have been timed out for **${timeoutDurationString}** in **${message.guild.name}** for suspected spamming.\n` + // [優化] 使用動態時間字串
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
          { name: "⏳ Duration", value: timeoutDurationString, inline: true } // [優化] 使用動態時間字串
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
  if (
    !antiSpamCache ||
    message.author.bot ||
    !message.inGuild() ||
    !message.member
  )
    return;

  const guildSettings = await getAntiSpamSettingsForGuild(message.guild.id);

  const settings = {
    spamThreshold:
      guildSettings?.messagethreshold ?? config.antiSpam.spamThreshold,
    timeWindow: guildSettings?.time_window ?? config.antiSpam.timeWindow,
    timeoutDuration:
      guildSettings?.timeoutduration ?? config.antiSpam.timeoutDuration,
    multiChannelSpamThreshold:
      guildSettings?.multichannelthreshold ??
      config.antiSpam.multiChannelSpamThreshold,
    multiChannelTimeWindow:
      guildSettings?.multichanneltimewindow ??
      config.antiSpam.multiChannelTimeWindow,
    ignoredUsers: config.antiSpam.ignoredUsers,
    ignoredRoles: config.antiSpam.ignoredRoles,
  };

  if (
    settings.ignoredUsers.includes(message.author.id) ||
    message.member.roles.cache.some((role) =>
      settings.ignoredRoles.includes(role.id)
    )
  ) {
    return;
  }

  const now = Date.now();
  const userId = message.author.id;
  const cacheKey = `antispam:${userId}`;

  let userData: UserMessageData | null = null;
  const redisData = await antiSpamCache.get(cacheKey);
  if (redisData) {
    try {
      userData = JSON.parse(redisData) as UserMessageData;
    } catch (e) {
      logger.error(
        `[Anti-Spam] Error parsing user data from Redis for key ${cacheKey}`,
        e
      );
      userData = null;
    }
  }

  if (!userData) {
    userData = { timestamps: [], punishedUntil: null };
  }

  // Synchronize state: If cache says punished but Discord says not, trust Discord.
  const isTimedOutInDiscord =
    message.member.communicationDisabledUntilTimestamp &&
    message.member.communicationDisabledUntilTimestamp > now;
  const isPunishedInCache =
    userData.punishedUntil && userData.punishedUntil > now;

  if (isPunishedInCache && !isTimedOutInDiscord) {
    logger.info(
      `[Anti-Spam] User ${message.member.id} timeout was manually removed. Resetting cache state.`
    );
    userData.punishedUntil = null;
    userData.timestamps = []; // Reset timestamps for a fresh start
  }

  // If user is still considered punished after sync, skip further processing.
  if (userData.punishedUntil && now < userData.punishedUntil) {
    return;
  }
  // If punishment has naturally expired, reset it for a clean slate.
  if (userData.punishedUntil && now >= userData.punishedUntil) {
    userData.punishedUntil = null;
    userData.timestamps = [];
  }

  const maxTimeWindow = Math.max(
    settings.timeWindow,
    settings.multiChannelTimeWindow
  );
  userData.timestamps = userData.timestamps.filter(
    (ts) => now - ts.ts < maxTimeWindow
  );
  userData.timestamps.push({ ts: now, channelId: message.channel.id });

  const reason = checkSpam(userData, message, settings);

  if (reason) {
    // Immediately mark as punished and update cache to prevent race conditions
    userData.punishedUntil = Date.now() + settings.timeoutDuration;
    if (antiSpamCache) {
      antiSpamCache.set(cacheKey, JSON.stringify(userData), {
        EX: Math.ceil(config.antiSpam.inactiveUserThreshold / 1000),
      });
    }

    await handleSpamAction(
      message,
      message.member,
      reason,
      userData,
      settings.timeoutDuration
    );
  } else {
    // If no punishment, just update the timestamps
    if (antiSpamCache) {
      antiSpamCache.set(cacheKey, JSON.stringify(userData), {
        EX: Math.ceil(config.antiSpam.inactiveUserThreshold / 1000),
      });
    }
  }
}
