import { CacheService } from "../services/CacheService";

// 替換成你的 Discord User ID
// 執行時可以用命令列參數: node dist/scripts/check-antispam-cache.js YOUR_USER_ID
const YOUR_USER_ID = process.argv[2] || "YOUR_USER_ID_HERE";

async function checkUserCache() {
  console.log("=== Checking Anti-Spam User Cache ===\n");
  
  const cacheService = new CacheService();
  const cacheKey = `antispam:${YOUR_USER_ID}`;
  
  try {
    const userData = await cacheService.get(cacheKey);
    
    if (userData) {
      console.log("✓ User cache found:");
      console.log(JSON.stringify(userData, null, 2));
      
      // Parse if it's a string
      if (typeof userData === 'string') {
        try {
          const parsed = JSON.parse(userData);
          console.log("\nParsed data:");
          console.log(JSON.stringify(parsed, null, 2));
          
          if (parsed.timestamps) {
            console.log(`\nTotal messages tracked: ${parsed.timestamps.length}`);
            console.log(`Punished until: ${parsed.punishedUntil ? new Date(parsed.punishedUntil) : 'Not punished'}`);
          }
        } catch (e) {
          console.log("Could not parse as JSON");
        }
      }
    } else {
      console.log("✗ No cache found for this user");
      console.log("This means either:");
      console.log("  1. User hasn't sent any messages yet");
      console.log("  2. Cache has expired");
      console.log("  3. Anti-spam handler is not running");
    }
  } catch (error) {
    console.error("✗ Error checking cache:", error);
  }
  
  console.log("\n=== Check Complete ===");
  process.exit(0);
}

checkUserCache().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
