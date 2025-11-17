import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionsBitField,
} from "discord.js";
import { Command } from "../../../interfaces/Command";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("permissions")
    .setDescription("Check bot permissions and available features in this server")
    .setDescriptionLocalizations({
      "zh-TW": "檢查機器人權限和可用功能",
    }),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: "This command can only be used in a server.",
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const botMember = interaction.guild.members.me;
    if (!botMember) {
      await interaction.editReply("Could not fetch bot member information.");
      return;
    }

    const permissions = botMember.permissions;

    // Define required permissions for each feature
    const features = [
      {
        name: "📝 Ticket System",
        required: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ManageChannels,
          PermissionsBitField.Flags.ManageThreads,
        ],
        description: "Create and manage support tickets",
      },
      {
        name: "🛡️ Anti-Spam",
        required: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.ModerateMembers,
        ],
        description: "Automatically timeout spammers",
      },
      {
        name: "📊 Report System",
        required: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
        ],
        description: "User reporting functionality",
      },
      {
        name: "🎭 Auto-React",
        required: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.AddReactions,
        ],
        description: "Automatically react to messages in specific channels",
      },
      {
        name: "💬 Keyword Responses",
        required: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
        ],
        description: "Auto-reply to specific keywords",
      },
      {
        name: "📖 Story Forum",
        required: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ManageThreads,
        ],
        description: "Story forum management features",
      },
    ];

    // Check each feature
    const featureStatus = features.map((feature) => {
      const hasAll = feature.required.every((perm) => permissions.has(perm));
      const status = hasAll ? "✅" : "❌";
      return `${status} **${feature.name}**\n   ${feature.description}`;
    });

    // Core permissions check
    const corePermissions = [
      {
        name: "View Channels",
        flag: PermissionsBitField.Flags.ViewChannel,
        critical: true,
      },
      {
        name: "Send Messages",
        flag: PermissionsBitField.Flags.SendMessages,
        critical: true,
      },
      {
        name: "Read Message History",
        flag: PermissionsBitField.Flags.ReadMessageHistory,
        critical: true,
      },
      {
        name: "Embed Links",
        flag: PermissionsBitField.Flags.EmbedLinks,
        critical: false,
      },
      {
        name: "Attach Files",
        flag: PermissionsBitField.Flags.AttachFiles,
        critical: false,
      },
      {
        name: "Add Reactions",
        flag: PermissionsBitField.Flags.AddReactions,
        critical: false,
      },
      {
        name: "Manage Channels",
        flag: PermissionsBitField.Flags.ManageChannels,
        critical: false,
      },
      {
        name: "Manage Threads",
        flag: PermissionsBitField.Flags.ManageThreads,
        critical: false,
      },
      {
        name: "Moderate Members (Timeout) ⚠️",
        flag: PermissionsBitField.Flags.ModerateMembers,
        critical: true,
      },
      {
        name: "Administrator",
        flag: PermissionsBitField.Flags.Administrator,
        critical: false,
      },
    ];

    const permissionStatus = corePermissions.map((perm) => {
      const has = permissions.has(perm.flag);
      const marker = perm.critical && !has ? "⚠️" : has ? "✅" : "❌";
      return `${marker} ${perm.name}`;
    });

    // Get bot's permission bitfield for debugging
    const permissionBitfield = permissions.bitfield.toString();

    // Check which roles can be moderated by the bot (for anti-spam)
    const guild = interaction.guild;
    const allRoles = guild.roles.cache
      .filter((role) => role.id !== guild.id) // Exclude @everyone
      .sort((a, b) => b.position - a.position);

    const botHighestRole = botMember.roles.highest;
    const moderatableRoles: string[] = [];
    const unmoderatable: string[] = [];

    allRoles.forEach((role) => {
      if (role.position < botHighestRole.position) {
        moderatableRoles.push(`✅ ${role.name}`);
      } else {
        unmoderatable.push(`❌ ${role.name}`);
      }
    });

    // Build embed
    const embed = new EmbedBuilder()
      .setTitle("🔐 Bot Permissions & Features")
      .setColor(0x5865f2)
      .setDescription(
        `**Bot Role:** ${botHighestRole.name} (Position: ${botHighestRole.position})\n` +
        `**Permission Bitfield:** \`${permissionBitfield}\``
      )
      .addFields(
        {
          name: "📋 Core Permissions",
          value: permissionStatus.join("\n") || "None",
          inline: false,
        },
        {
          name: "🎯 Available Features",
          value: featureStatus.join("\n\n") || "None",
          inline: false,
        }
      )
      .setFooter({
        text: `Server: ${interaction.guild.name}`,
      })
      .setTimestamp();

    // Add anti-spam specific information
    if (permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
      const moderatableList =
        moderatableRoles.length > 0
          ? moderatableRoles.slice(0, 10).join("\n") +
            (moderatableRoles.length > 10
              ? `\n... and ${moderatableRoles.length - 10} more`
              : "")
          : "None (bot role is at the bottom)";

      const unmoderateList =
        unmoderatable.length > 0
          ? unmoderatable.slice(0, 5).join("\n") +
            (unmoderatable.length > 5
              ? `\n... and ${unmoderatable.length - 5} more`
              : "")
          : "None";

      embed.addFields(
        {
          name: "🛡️ Anti-Spam: Roles Bot Can Timeout",
          value: moderatableList,
          inline: true,
        },
        {
          name: "⚠️ Anti-Spam: Roles Bot CANNOT Timeout",
          value: unmoderateList,
          inline: true,
        }
      );
    } else {
      embed.addFields({
        name: "⚠️ Anti-Spam Status",
        value:
          "❌ Bot lacks **Moderate Members** permission.\nAnti-spam feature will not work.",
        inline: false,
      });
    }

    // Add recommendations if there are issues
    const issues: string[] = [];
    if (!permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
      issues.push(
        "⚠️ **CRITICAL:** Enable **Moderate Members** permission\n" +
        "   → Server Settings → Roles → Bot Role → Permissions\n" +
        "   → Enable \"Timeout Members\" (暫時隔離成員)\n" +
        "   → This is required for anti-spam to work!"
      );
    }
    if (!permissions.has(PermissionsBitField.Flags.ManageChannels)) {
      issues.push(
        "• Enable **Manage Channels** permission for ticket system"
      );
    }
    if (unmoderatable.length > moderatableRoles.length) {
      issues.push(
        "• **Move bot role higher** in Server Settings → Roles\n" +
        "   → Drag bot role above roles you want it to moderate"
      );
    }
    
    // Add specific note about role hierarchy
    if (permissions.has(PermissionsBitField.Flags.ModerateMembers) && unmoderatable.length > 0) {
      issues.push(
        "ℹ️ Bot has Moderate Members permission but cannot timeout users\n" +
        "   with roles higher than or equal to the bot's role position.\n" +
        "   Current bot position: " + botHighestRole.position
      );
    }

    if (issues.length > 0) {
      embed.addFields({
        name: "💡 Setup Instructions",
        value: issues.join("\n\n"),
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  },
};

export { command };
