import { CacheService } from "../services/CacheService";
import logger from "../utils/logger";

const USER_ID = process.argv[2];
const INTERVAL = 1000; // 每秒檢查一次

if (!USER_ID) {
  console.error("Usage: node dist/scripts/monitor-antispam.js <USER_ID>");
  process.exit(1);
}

async function monitor() {
  const cacheService = new CacheService();
  const cacheKey = `antispam:${USER_ID}`;
  
  console.log(`=== Monitoring Anti-Spam Cache for User ${USER_ID} ===`);
  console.log(`Press Ctrl+C to stop\n`);
  
  let lastData: any = null;
  
  setInterval(async () => {
    try {
      const rawData = await cacheService.get(cacheKey);
      
      if (!rawData) {
        if (lastData !== null) {
          console.log(`[${new Date().toISOString()}] Cache cleared or expired`);
          lastData = null;
        }
        return;
      }
      
      const data = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
      
      // 只在資料變化時輸出
      const dataStr = JSON.stringify(data);
      if (dataStr !== JSON.stringify(lastData)) {
        console.log(`\n[${new Date().toISOString()}] Cache updated:`);
        console.log(`  Messages tracked: ${data.timestamps?.length || 0}`);
        
        if (data.timestamps && data.timestamps.length > 0) {
          const now = Date.now();
          console.log(`  Recent messages:`);
          data.timestamps.slice(-5).forEach((ts: any, i: number) => {
            const age = ((now - ts.ts) / 1000).toFixed(1);
            console.log(`    ${i + 1}. ${age}s ago in channel ${ts.channelId}`);
          });
        }
        
        if (data.punishedUntil) {
          const remaining = Math.max(0, data.punishedUntil - Date.now());
          console.log(`  Punished: Yes (${(remaining / 1000).toFixed(0)}s remaining)`);
        } else {
          console.log(`  Punished: No`);
        }
        
        lastData = data;
      }
    } catch (error) {
      console.error(`Error monitoring cache:`, error);
    }
  }, INTERVAL);
}

monitor().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
