/**
 * General Content Generators
 * 
 * This module contains content generation functions for general user information
 * and usage pattern analysis views.
 * 
 * Requirements: 1.1, 1.3, 1.4, 2.1, 2.2, 4.2, 4.5, 5.2, 5.3
 */

import { User, Client } from "discord.js";
import {
  UserInfoData,
  CommandUsagePattern,
} from "../../../../shared/database/types";
import {
  formatTopCommands,
  formatInterval,
  calculateCV,
  createProgressBar,
} from "../formatters";
import { getSuspicionLevel } from "../analyzer";
import { CommandTypeAnalysis } from "../financial-analyzer";
import { ContentGeneratorOptions } from "./types";

/**
 * 生成綜合資訊內容
 * 
 * Task 7.1: 更新以包含活動趨勢
 * - 在伺服器列表中添加活動趨勢指標
 * - 顯示 7 天變化百分比
 * - 添加熱門/冷卻 emoji 指標
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */
export function createGeneralContent(
  options: ContentGeneratorOptions
): string {
  const { targetUser, userInfo, client, serverActivityTrends } = options;

  // 創建伺服器活動趨勢映射
  const trendsMap = new Map<string, {
    recentCount: number;
    previousCount: number;
    changePercentage: number;
  }>();
  
  if (serverActivityTrends) {
    serverActivityTrends.forEach(trend => {
      trendsMap.set(trend.guildId, trend);
    });
  }

  // 格式化伺服器列表，包含活動趨勢
  let topGuildsContent = '';
  if (userInfo.top_guilds && userInfo.top_guilds.length > 0) {
    userInfo.top_guilds.forEach((guild, index) => {
      const guildObj = client.guilds.cache.get(guild.guild_id);
      const guildName = guildObj ? guildObj.name : `未知伺服器 (${guild.guild_id})`;
      
      // 獲取活動趨勢
      const trend = trendsMap.get(guild.guild_id);
      let trendIndicator = '';
      
      if (trend) {
        const changePercent = trend.changePercentage;
        
        // Requirement 3.4: 活動增加超過 50% 標示為 🔥 熱門
        if (changePercent > 50) {
          trendIndicator = ` 🔥 (+${changePercent.toFixed(0)}%)`;
        }
        // Requirement 3.5: 活動減少超過 50% 標示為 ❄️ 冷卻
        else if (changePercent < -50) {
          trendIndicator = ` ❄️ (${changePercent.toFixed(0)}%)`;
        }
        // Requirement 3.3: 顯示活動變化百分比
        else if (Math.abs(changePercent) > 10) {
          const sign = changePercent > 0 ? '+' : '';
          trendIndicator = ` (${sign}${changePercent.toFixed(0)}%)`;
        }
      }
      
      topGuildsContent += `${index + 1}. **${guildName}**${trendIndicator}\n`;
      topGuildsContent += `   使用次數: ${guild.usage_count} 次\n`;
    });
  } else {
    topGuildsContent = '無使用記錄。\n';
  }

  const topCommandsContent = formatTopCommands(userInfo.top_commands);

  return (
    `# 👤 ${targetUser.username} 的使用者資訊\n\n` +
    `## 📋 基本資訊\n` +
    `- **使用者標籤**: ${targetUser.tag}\n` +
    `- **使用者 ID**: \`${targetUser.id}\`\n` +
    `- **帳號建立時間**: <t:${Math.floor(targetUser.createdTimestamp / 1000)}:R>\n\n` +
    `## 📊 活動統計\n` +
    `### 最活躍的伺服器\n` +
    `> 💡 趨勢指標：🔥 熱門 (+50%以上) | ❄️ 冷卻 (-50%以上)\n\n` +
    `${topGuildsContent}\n` +
    `### 最常用指令 (Top 10)\n${topCommandsContent}`
  );
}

/**
 * 生成使用模式分析內容
 * 
 * Task 7.2: 更新以包含指令類型分析
 * - 添加指令類型分析區塊
 * - 顯示類別分布與進度條
 * - 顯示每個類別的 Top 3 指令
 * - 添加集中度警告（>70%）
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 * Task 11.2: 處理缺少資料的情況
 */
export function createUsagePatternContent(
  options: ContentGeneratorOptions
): string {
  const { targetUser, usagePatterns, recentFrequency, commandTypeAnalysis } = options;

  // Task 11.2: 檢查是否有使用模式資料
  if (!usagePatterns || usagePatterns.length === 0) {
    return `# 🔍 ${targetUser.username} 的使用模式分析\n\n${getNoDataMessage('commands')}`;
  }

  let content = `# 🔍 ${targetUser.username} 的使用模式分析\n\n`;
  content += `> 此分析用於檢測異常使用模式，協助識別潛在的小帳或機器人行為。\n\n`;

  // Task 7.2: 添加指令類型分析區塊
  if (commandTypeAnalysis && commandTypeAnalysis.categories.length > 0) {
    content += `## 📦 指令類型分析\n`;
    content += `> 分析使用者的指令使用習慣，了解主要活動類型\n\n`;
    
    // Requirement 6.1: 顯示各類指令的使用次數
    // Requirement 6.2: 顯示各類指令的使用佔比
    // Requirement 6.3: 使用 emoji 標示各類指令
    commandTypeAnalysis.categories.forEach((category: any) => {
      const bar = createProgressBar(category.percentage, 20);
      
      content += `### ${category.emoji} ${category.name}\n`;
      content += `- **使用次數**: ${category.count.toLocaleString()} 次 (${category.percentage.toFixed(1)}%)\n`;
      content += `- **分布**: ${bar}\n`;
      
      // Requirement 6.5: 顯示各類指令的 Top 3 指令
      if (category.topCommands.length > 0) {
        content += `- **Top ${category.topCommands.length}**: `;
        content += category.topCommands
          .map((cmd: any) => `\`${cmd.name}\` (${cmd.count})`)
          .join(', ');
        content += `\n`;
      }
      
      content += `\n`;
    });
    
    // Requirement 6.4: 某類指令佔比超過 70% 標示為高度集中
    if (commandTypeAnalysis.hasConcentration && commandTypeAnalysis.concentratedCategory) {
      const concentratedCat = commandTypeAnalysis.categories.find(
        (c: any) => c.category === commandTypeAnalysis.concentratedCategory
      );
      
      if (concentratedCat) {
        content += `⚠️ **高度集中警告**: ${concentratedCat.emoji} ${concentratedCat.name} 佔比達 ${concentratedCat.percentage.toFixed(1)}%\n`;
        content += `> 使用者的指令使用高度集中在單一類別，可能表示特定的使用模式或行為。\n\n`;
      }
    }
    
    content += `---\n\n`;
  }

  if (recentFrequency.length > 0) {
    content += `## ⚡ 最近 60 分鐘使用頻率\n`;
    recentFrequency.forEach((freq) => {
      content += `- \`${freq.command_name}\`: ${freq.usage_count} 次\n`;
    });
    content += `\n`;
  }

  content += `## 📊 指令使用模式詳細分析\n\n`;

  usagePatterns.slice(0, 15).forEach((pattern) => {
    const suspicion = getSuspicionLevel(pattern);
    const statusEmoji =
      suspicion.level === "高度可疑"
        ? "🚨"
        : suspicion.level === "可疑"
          ? "⚠️"
          : "✅";

    content += `### ${statusEmoji} \`${pattern.command_name}\` - ${suspicion.level}\n`;
    content += `- **使用次數**: ${pattern.usage_count} 次\n`;
    if (pattern.avg_interval_seconds > 0) {
      content += `- **平均使用間隔**: ${formatInterval(pattern.avg_interval_seconds)} ± ${formatInterval(pattern.interval_stddev_seconds)}\n`;
      const intervalCV = calculateCV(
        pattern.interval_stddev_seconds,
        pattern.avg_interval_seconds
      );
      content += `- **間隔穩定度**: CV = ${intervalCV.toFixed(1)}% ${intervalCV < 10 ? "(極度規律 ⚠️)" : intervalCV < 30 ? "(規律)" : "(正常)"}\n`;
    }
    const timeSpanDays =
      (new Date(pattern.last_used_at).getTime() -
        new Date(pattern.first_used_at).getTime()) /
      (1000 * 60 * 60 * 24);
    if (timeSpanDays > 0) {
      content += `- **使用頻率**: ${(pattern.usage_count / timeSpanDays).toFixed(1)} 次/天\n`;
    }
    content += `- **首次使用**: <t:${Math.floor(new Date(pattern.first_used_at).getTime() / 1000)}:R>\n`;
    content += `- **最後使用**: <t:${Math.floor(new Date(pattern.last_used_at).getTime() / 1000)}:R>\n`;

    if (suspicion.reasons.length > 0) {
      content += `- **可疑原因**:\n`;
      suspicion.reasons.forEach((reason) => {
        content += `  - ${reason}\n`;
      });
    }
    content += `\n`;
  });

  return content;
}

/**
 * Task 11.2: 檢查並處理缺少資料的情況
 * 
 * 根據資料類型返回適當的「無資料」訊息
 * 
 * Requirements: 15.1, 15.2, 15.5
 */
export function getNoDataMessage(dataType: 'transactions' | 'commands' | 'activity' | 'financial'): string {
  const messages = {
    transactions: '📭 無交易記錄',
    commands: '📭 無使用記錄',
    activity: '📭 資料不足',
    financial: '📭 無財務資料'
  };
  
  return messages[dataType] || '📭 資料不可用';
}
