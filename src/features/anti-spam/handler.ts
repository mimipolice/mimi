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
import { getAntiSpamLogChannel } from "../../repositories/admin.repository";
import { getAntiSpamSettingsForGuild } from "../../shared/cache";
import { formatDistanceStrict } from "date-fns";

import { CacheService } from "../../services/CacheService";

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
      ts.channelId === message.channel.id && now - ts.ts <= settings.timeWindow
  );
  if (singleChannelMessages.length >= settings.spamThreshold) {
    return "Fast single-channel spam";
  }

  // 2. Multi-channel spam check
  const multiChannelMessages = timestamps.filter(
    (ts) => now - ts.ts <= settings.multiChannelTimeWindow
  );
  const uniqueChannels = new Set(
    multiChannelMessages.map((ts) => ts.channelId)
  );
  
  // Check if user is spamming across multiple channels
  // Need at least multiChannelSpamThreshold unique channels
  if (uniqueChannels.size >= settings.multiChannelSpamThreshold) {
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
  const timeoutDurationString = formatDistanceStrict(0, timeoutDuration);

  try {
    // Try to timeout the member directly
    await member.timeout(timeoutDuration, reason);
    
    logger.info(
      `[Anti-Spam] ✓ Successfully timed out user ${member.user.tag} (${member.id}) in guild "${message.guild.name}" (${message.guild.id}) for ${timeoutDurationString}. Reason: ${reason}`
    );
    
    await message.channel.send(
      `User ${member.toString()} has been timed out for ${timeoutDurationString} due to suspected spamming (${reason}).`
    );

    // Clear message history after successful timeout
    userData.timestamps = [];
  } catch (err: any) {
    // Log detailed error information with guild context
    logger.error(
      `[Anti-Spam] Failed to timeout user ${member.user.tag} (${member.id}) in guild "${message.guild.name}" (${message.guild.id}):`,
      {
        error: err.message,
        code: err.code,
        httpStatus: err.status,
        guildId: message.guild.id,
        guildName: message.guild.name,
        channelId: message.channel.id,
        userId: member.id,
        userTag: member.user.tag,
      }
    );
    
    // Notify in channel about the failure
    try {
      if (err.code === 50013) {
        // Missing Permissions
        await message.channel.send(
          `⚠️ Spam detected from ${member.toString()}, but I lack permissions to timeout this user. ` +
          `Please ensure my role is higher than theirs in Server Settings → Roles.`
        );
      } else {
        await message.channel.send(
          `⚠️ Spam detected from ${member.toString()}, but I cannot timeout this user (Error: ${err.code || 'Unknown'}).`
        );
      }
    } catch (notifyErr) {
      logger.error(
        `[Anti-Spam] Could not send failure notification in guild "${message.guild.name}" (${message.guild.id}):`,
        notifyErr
      );
    }
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
    logger.warn(
      `[Anti-Spam] Could not DM user ${member.user.tag} (${member.id}) in guild "${message.guild.name}" (${message.guild.id}).`
    );
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
        `[Anti-Spam] No log channel configured for guild "${message.guild.name}" (${message.guild.id}).`
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
      `[Anti-Spam] Error during admin notification process in guild "${message.guild.name}" (${message.guild.id}):`,
      adminNotifyError
    );
  }

  // [優化] 移除原有的 userMessageHistory.delete(member.id) 和長 setTimeout
}

// --- 4. Main Exported Function ---
export async function handleAntiSpam(message: Message) {
  const cacheService = new CacheService();
  
  // Early return checks with logging
  if (message.author.bot) {
    logger.debug(`[Anti-Spam] Skipping bot message from ${message.author.tag}`);
    return;
  }
  if (!message.inGuild()) {
    logger.debug(`[Anti-Spam] Skipping DM from ${message.author.tag}`);
    return;
  }
  if (!message.member) {
    logger.debug(`[Anti-Spam] No member object for ${message.author.tag}`);
    return;
  }
  
  logger.debug(`[Anti-Spam] Processing message from ${message.author.tag} (${message.author.id}) in guild ${message.guild.id}`);

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

  logger.debug(`[Anti-Spam] Settings for guild ${message.guild.id}:`, settings);

  if (
    settings.ignoredUsers.includes(message.author.id) ||
    message.member.roles.cache.some((role) =>
      settings.ignoredRoles.includes(role.id)
    )
  ) {
    logger.debug(`[Anti-Spam] User ${message.author.tag} is in ignored list, skipping`);
    return;
  }

  const now = Date.now();
  const userId = message.author.id;
  const cacheKey = `antispam:${userId}`;

  const userDataFromCache = await cacheService.get<UserMessageData>(cacheKey);

  // Reconstruct the object from cache to ensure data integrity and prevent crashes.
  // This handles cases where cached data might be corrupted or in an old format.
  const userData: UserMessageData = {
    timestamps: userDataFromCache?.timestamps || [],
    punishedUntil: userDataFromCache?.punishedUntil || null,
  };

  // Synchronize state: If cache says punished but Discord says not, trust Discord.
  const isTimedOutInDiscord =
    message.member.communicationDisabledUntilTimestamp &&
    message.member.communicationDisabledUntilTimestamp > now;
  const isPunishedInCache =
    userData.punishedUntil && userData.punishedUntil > now;

  if (isPunishedInCache && !isTimedOutInDiscord) {
    logger.debug(
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
  
  // Add current message BEFORE checking spam to include it in the count
  userData.timestamps.push({ ts: now, channelId: message.channel.id });

  // Debug logging
  const messagesInChannel = userData.timestamps.filter(ts => ts.channelId === message.channel.id).length;
  logger.debug(`[Anti-Spam] User ${message.author.tag}: ${messagesInChannel}/${settings.spamThreshold} messages in ${settings.timeWindow}ms window`);

  const reason = checkSpam(userData, message, settings);
  
  if (reason) {
    logger.warn(
      `[Anti-Spam] ⚠️ SPAM DETECTED for ${message.author.tag} in guild "${message.guild.name}" (${message.guild.id}): ${reason}`
    );
  }

  if (reason) {
    // Immediately mark as punished and update cache to prevent race conditions
    userData.punishedUntil = Date.now() + settings.timeoutDuration;
    await cacheService.set(
      cacheKey,
      userData,
      config.antiSpam.inactiveUserThreshold
    );

    await handleSpamAction(
      message,
      message.member,
      reason,
      userData,
      settings.timeoutDuration
    );
  } else {
    // If no punishment, just update the timestamps
    await cacheService.set(
      cacheKey,
      userData,
      config.antiSpam.inactiveUserThreshold
    );
    logger.debug(`[Anti-Spam] Cache updated: ${userData.timestamps.length} total messages tracked`);
  }
}
