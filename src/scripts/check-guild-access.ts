import { Client, GatewayIntentBits, PermissionsBitField } from "discord.js";
import logger from "../utils/logger";

const GUILD_ID = "1256599582801137764";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once("ready", async () => {
  console.log(`=== Guild Access Check ===`);
  console.log(`Bot: ${client.user?.tag}\n`);

  try {
    // Check if bot is in the guild
    const guild = client.guilds.cache.get(GUILD_ID);
    
    if (!guild) {
      console.log(`❌ Bot is NOT in guild ${GUILD_ID}`);
      console.log(`\nPossible reasons:`);
      console.log(`1. Bot was never added to this server`);
      console.log(`2. Bot was kicked/banned from this server`);
      console.log(`3. Guild ID is incorrect`);
      console.log(`\nBot is currently in ${client.guilds.cache.size} guilds:`);
      client.guilds.cache.forEach(g => {
        console.log(`  - ${g.name} (${g.id})`);
      });
      process.exit(1);
    }

    console.log(`✓ Bot is in guild: ${guild.name}`);
    console.log(`  Members: ${guild.memberCount}`);
    console.log(`  Owner: ${guild.ownerId}`);

    // Check bot member
    const botMember = guild.members.me;
    if (!botMember) {
      console.log(`\n❌ Cannot get bot member object`);
      process.exit(1);
    }

    console.log(`\n✓ Bot member found`);
    console.log(`  Nickname: ${botMember.nickname || "None"}`);
    console.log(`  Joined at: ${botMember.joinedAt?.toISOString()}`);

    // Check permissions
    console.log(`\n=== Bot Permissions ===`);
    const permissions = botMember.permissions;
    
    const requiredPermissions = [
      { name: "View Channels", flag: PermissionsBitField.Flags.ViewChannel },
      { name: "Send Messages", flag: PermissionsBitField.Flags.SendMessages },
      { name: "Read Message History", flag: PermissionsBitField.Flags.ReadMessageHistory },
      { name: "Moderate Members (Timeout)", flag: PermissionsBitField.Flags.ModerateMembers },
      { name: "Manage Messages", flag: PermissionsBitField.Flags.ManageMessages },
    ];

    let hasAllPermissions = true;
    for (const perm of requiredPermissions) {
      const has = permissions.has(perm.flag);
      console.log(`  ${has ? "✓" : "✗"} ${perm.name}`);
      if (!has && perm.name !== "Manage Messages") {
        hasAllPermissions = false;
      }
    }

    // Check channels
    console.log(`\n=== Channels Bot Can See ===`);
    const channels = guild.channels.cache;
    const textChannels = channels.filter(c => c.isTextBased());
    
    console.log(`Total channels: ${channels.size}`);
    console.log(`Text channels: ${textChannels.size}`);

    if (textChannels.size === 0) {
      console.log(`\n❌ Bot cannot see any text channels!`);
      console.log(`This is why messageCreate events are not received.`);
      console.log(`\nFix: Check channel permissions and ensure bot role has:`);
      console.log(`  - View Channel`);
      console.log(`  - Read Message History`);
      hasAllPermissions = false;
    } else {
      console.log(`\nText channels bot can see:`);
      textChannels.forEach(channel => {
        const perms = channel.permissionsFor(botMember);
        const canView = perms?.has(PermissionsBitField.Flags.ViewChannel);
        const canRead = perms?.has(PermissionsBitField.Flags.ReadMessageHistory);
        const canSend = perms?.has(PermissionsBitField.Flags.SendMessages);
        
        console.log(`  ${canView && canRead ? "✓" : "✗"} #${channel.name} (${channel.id})`);
        if (!canView || !canRead) {
          console.log(`      Missing: ${!canView ? "View Channel " : ""}${!canRead ? "Read Message History" : ""}`);
        }
      });
    }

    // Check roles
    console.log(`\n=== Bot Roles ===`);
    const roles = botMember.roles.cache;
    console.log(`Bot has ${roles.size} roles:`);
    roles.forEach(role => {
      console.log(`  - ${role.name} (${role.id})`);
    });

    // Summary
    console.log(`\n=== Summary ===`);
    if (hasAllPermissions && textChannels.size > 0) {
      console.log(`✅ Bot should be able to receive messageCreate events`);
      console.log(`\nIf you still don't receive events, try:`);
      console.log(`1. Send a message in one of the channels listed above`);
      console.log(`2. Check bot logs: pm2 logs your-bot-name`);
      console.log(`3. Restart the bot: pm2 restart your-bot-name`);
    } else {
      console.log(`❌ Bot configuration issues detected`);
      console.log(`\nFix the issues above and try again.`);
    }

  } catch (error) {
    console.error(`\n❌ Error:`, error);
    process.exit(1);
  }

  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN).catch((error) => {
  console.error("Failed to login:", error);
  process.exit(1);
});
