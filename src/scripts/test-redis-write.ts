import { CacheService } from "../services/CacheService";
import logger from "../utils/logger";

async function testRedisWrite() {
  console.log("=== Testing Redis Write Operations ===\n");
  
  const cacheService = new CacheService();
  const testKey = "test:antispam:write";
  
  try {
    // Test 1: Simple write
    console.log("1. Testing simple write...");
    await cacheService.set(testKey, "test-value", 60);
    console.log("   ✓ Write successful");
    
    // Test 2: Read back
    console.log("\n2. Testing read...");
    const value = await cacheService.get(testKey);
    if (value === "test-value") {
      console.log("   ✓ Read successful, value matches");
    } else {
      console.log(`   ✗ Read failed, got: ${value}`);
    }
    
    // Test 3: Write JSON
    console.log("\n3. Testing JSON write...");
    const testData = {
      timestamps: [
        { ts: Date.now(), channelId: "test-channel" }
      ],
      punishedUntil: null
    };
    await cacheService.set(testKey + ":json", JSON.stringify(testData), 60);
    console.log("   ✓ JSON write successful");
    
    // Test 4: Read JSON back
    console.log("\n4. Testing JSON read...");
    const jsonValue = await cacheService.get(testKey + ":json");
    if (jsonValue) {
      const parsed = JSON.parse(jsonValue as string);
      console.log("   ✓ JSON read successful");
      console.log("   Data:", parsed);
    } else {
      console.log("   ✗ JSON read failed");
    }
    
    // Test 5: Write with anti-spam key format
    console.log("\n5. Testing anti-spam key format...");
    const userId = "1191600548844163194";
    const antiSpamKey = `antispam:${userId}`;
    const antiSpamData = {
      timestamps: [
        { ts: Date.now() - 5000, channelId: "channel-1" },
        { ts: Date.now() - 3000, channelId: "channel-1" },
        { ts: Date.now() - 1000, channelId: "channel-1" },
      ],
      punishedUntil: null
    };
    
    await cacheService.set(antiSpamKey, JSON.stringify(antiSpamData), 7200);
    console.log(`   ✓ Anti-spam data written to key: ${antiSpamKey}`);
    
    // Test 6: Read it back
    console.log("\n6. Reading anti-spam data back...");
    const antiSpamValue = await cacheService.get(antiSpamKey);
    if (antiSpamValue) {
      const parsed = JSON.parse(antiSpamValue as string);
      console.log("   ✓ Anti-spam data read successful");
      console.log(`   Timestamps count: ${parsed.timestamps.length}`);
      console.log(`   Punished: ${parsed.punishedUntil ? "Yes" : "No"}`);
    } else {
      console.log("   ✗ Anti-spam data read failed");
    }
    
    // Cleanup
    console.log("\n7. Cleaning up test keys...");
    await cacheService.del(testKey);
    await cacheService.del(testKey + ":json");
    // Keep the anti-spam test key for manual inspection
    console.log(`   ✓ Cleanup done (kept ${antiSpamKey} for inspection)`);
    
    console.log("\n=== All Tests Passed ===");
    console.log(`\nYou can manually check the anti-spam key with:`);
    console.log(`redis-cli GET ${antiSpamKey}`);
    
  } catch (error) {
    console.error("\n✗ Test failed:", error);
    process.exit(1);
  }
  
  process.exit(0);
}

testRedisWrite().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
