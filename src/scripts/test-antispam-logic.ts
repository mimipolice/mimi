// 這個腳本模擬 anti-spam 的檢測邏輯，用於測試
interface UserMessageData {
  timestamps: { ts: number; channelId: string }[];
  punishedUntil: number | null;
}

interface Settings {
  spamThreshold: number;
  timeWindow: number;
  multiChannelSpamThreshold: number;
  multiChannelTimeWindow: number;
}

function checkSpam(
  userData: UserMessageData,
  currentChannelId: string,
  settings: Settings
): string | null {
  const now = Date.now();
  const { timestamps } = userData;

  console.log(`\n=== Spam Check ===`);
  console.log(`Current time: ${now}`);
  console.log(`Total timestamps: ${timestamps.length}`);
  console.log(`Settings:`, settings);

  // 1. Single-channel spam check
  const singleChannelMessages = timestamps.filter(
    (ts) =>
      ts.channelId === currentChannelId && now - ts.ts <= settings.timeWindow
  );
  
  console.log(`\nSingle-channel check:`);
  console.log(`  Messages in current channel (${currentChannelId}): ${singleChannelMessages.length}`);
  console.log(`  Threshold: ${settings.spamThreshold}`);
  console.log(`  Time window: ${settings.timeWindow}ms`);
  
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
  
  console.log(`\nMulti-channel check:`);
  console.log(`  Messages across channels: ${multiChannelMessages.length}`);
  console.log(`  Unique channels: ${uniqueChannels.size}`);
  console.log(`  Threshold: ${settings.multiChannelSpamThreshold} channels`);
  console.log(`  Time window: ${settings.multiChannelTimeWindow}ms`);
  
  if (uniqueChannels.size >= settings.multiChannelSpamThreshold) {
    return `Multi-channel spam (${uniqueChannels.size} channels)`;
  }

  return null;
}

// 模擬測試
console.log("=== Anti-Spam Logic Test ===\n");

const settings: Settings = {
  spamThreshold: 5,
  timeWindow: 10000,
  multiChannelSpamThreshold: 6,
  multiChannelTimeWindow: 12000,
};

const userData: UserMessageData = {
  timestamps: [],
  punishedUntil: null,
};

const channelId = "test-channel-123";
const now = Date.now();

console.log("Simulating 5 messages in 10 seconds...\n");

// 模擬發送 5 條訊息
for (let i = 0; i < 5; i++) {
  const messageTime = now - (4 - i) * 2000; // 每 2 秒一條
  userData.timestamps.push({ ts: messageTime, channelId });
  console.log(`Message ${i + 1}: ${new Date(messageTime).toISOString()}`);
}

// 添加當前訊息（第 5 條）
userData.timestamps.push({ ts: now, channelId });
console.log(`Message 5 (current): ${new Date(now).toISOString()}`);

// 檢查是否觸發
const result = checkSpam(userData, channelId, settings);

console.log(`\n=== Result ===`);
if (result) {
  console.log(`✓ SPAM DETECTED: ${result}`);
} else {
  console.log(`✗ No spam detected`);
}

console.log("\n=== Test Complete ===");
