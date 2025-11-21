/**
 * 使用模式分析工具
 */

import { CommandUsagePattern } from "../../../shared/database/types";
import { calculateCV, formatInterval } from "./formatters";

/**
 * 根據使用模式判斷可疑程度
 */
export function getSuspicionLevel(pattern: CommandUsagePattern): {
  level: "正常" | "可疑" | "高度可疑";
  reasons: string[];
} {
  const reasons: string[] = [];
  let suspicionScore = 0;

  if (pattern.avg_interval_seconds > 0) {
    const intervalCV = calculateCV(
      pattern.interval_stddev_seconds,
      pattern.avg_interval_seconds
    );
    if (intervalCV < 10 && pattern.usage_count > 10) {
      suspicionScore += 3;
      reasons.push(`使用間隔過於規律 (CV: ${intervalCV.toFixed(1)}%)`);
    }

    if (pattern.avg_interval_seconds < 5 && pattern.usage_count > 20) {
      suspicionScore += 3;
      reasons.push(
        `使用頻率異常高 (平均間隔: ${formatInterval(pattern.avg_interval_seconds)})`
      );
    }

    if (pattern.avg_interval_seconds < 2 && pattern.usage_count > 10) {
      suspicionScore += 2;
      reasons.push(`疑似使用自動化工具 (平均間隔 < 2秒)`);
    }
  }

  if (pattern.usage_count > 200) {
    suspicionScore += 2;
    reasons.push(`使用次數異常多 (${pattern.usage_count}次)`);
  } else if (pattern.usage_count > 100) {
    suspicionScore += 1;
    reasons.push(`使用次數偏高 (${pattern.usage_count}次)`);
  }

  const timeSpanDays =
    (new Date(pattern.last_used_at).getTime() -
      new Date(pattern.first_used_at).getTime()) /
    (1000 * 60 * 60 * 24);
  if (timeSpanDays > 0 && pattern.usage_count / timeSpanDays > 50) {
    suspicionScore += 1;
    reasons.push(
      `每日平均使用次數過高 (${(pattern.usage_count / timeSpanDays).toFixed(1)}次/天)`
    );
  }

  if (suspicionScore >= 5) return { level: "高度可疑", reasons };
  if (suspicionScore >= 3) return { level: "可疑", reasons };
  return { level: "正常", reasons: [] };
}
