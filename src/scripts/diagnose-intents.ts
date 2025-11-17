import { Client, GatewayIntentBits, Events } from "discord.js";
import logger from "../utils/logger";

console.log("=== Discord Intents Diagnostic Tool ===\n");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildScheduledEvents,
    GatewayIntentBits.GuildMessageReactions,
  ],
});

console.log("1. Checking configured intents...");
console.log("   Configured intents in code:");
console.log("   ✓ Guilds");
console.log("   ✓ GuildMessages");
console.log("   ✓ MessageContent");
console.log("   ✓ DirectMessages");
console.log("   ✓ GuildScheduledEvents");
console.log("   ✓ GuildMessageReactions");

let messageReceived = false;
let messageContentAvailable = false;

client.once(Events.ClientReady, (c) => {
  console.log("\n2. Bot connected successfully!");
  console.log(`   Logged in as: ${c.user.tag}`);
  console.log(`   Bot ID: ${c.user.id}`);
  
  console.log("\n3. Testing message event listener...");
  console.log("   Please send a message in any channel the bot can see.");
  console.log("   Waiting for message... (timeout in 30 seconds)");
  
  setTimeout(() => {
    if (!messageReceived) {
      console.log("\n❌ PROBLEM DETECTED:");
      console.log("   No message received within 30 seconds.");
      console.log("\n   Possible causes:");
      console.log("   1. MESSAGE CONTENT INTENT not enabled in Discord Developer Portal");
      console.log("   2. GUILD MESSAGES INTENT not enabled in Discord Developer Portal");
      console.log("   3. Bot doesn't have access to any channels");
      console.log("\n   Fix: Go to https://discord.com/developers/applications");
      console.log("   → Select your bot → Bot → Enable 'MESSAGE CONTENT INTENT'");
      process.exit(1);
    }
  }, 30000);
});

client.on(Events.MessageCreate, (message) => {
  if (message.author.bot) return;
  
  messageReceived = true;
  
  console.log("\n✓ Message event received!");
  console.log(`   Author: ${message.author.tag}`);
  console.log(`   Channel: ${message.channel.id}`);
  console.log(`   Guild: ${message.guild?.name || "DM"}`);
  
  if (message.content && message.content.length > 0) {
    messageContentAvailable = true;
    console.log(`   Content: "${message.content}"`);
    console.log("\n✅ SUCCESS: MESSAGE CONTENT INTENT is working!");
  } else {
    console.log(`   Content: [EMPTY]`);
    console.log("\n❌ PROBLEM: MESSAGE CONTENT INTENT is NOT working!");
    console.log("   The message event is received, but content is empty.");
    console.log("\n   Fix: Enable 'MESSAGE CONTENT INTENT' in Discord Developer Portal:");
    console.log("   https://discord.com/developers/applications");
    console.log("   → Select your bot → Bot → Privileged Gateway Intents");
    console.log("   → Enable 'MESSAGE CONTENT INTENT'");
    console.log("   → Save Changes → Restart your bot");
  }
  
  console.log("\n=== Diagnostic Complete ===");
  console.log("\nSummary:");
  console.log(`  Message Event: ${messageReceived ? "✓ Working" : "✗ Not working"}`);
  console.log(`  Message Content: ${messageContentAvailable ? "✓ Working" : "✗ Not working"}`);
  
  if (messageReceived && messageContentAvailable) {
    console.log("\n🎉 All intents are working correctly!");
    console.log("   Your anti-spam feature should work now.");
  }
  
  process.exit(messageContentAvailable ? 0 : 1);
});

client.on(Events.Error, (error) => {
  console.error("\n❌ Client error:", error);
  process.exit(1);
});

client.login(process.env.DISCORD_TOKEN).catch((error) => {
  console.error("\n❌ Failed to login:", error);
  console.log("\nCheck your DISCORD_TOKEN in .env file");
  process.exit(1);
});
