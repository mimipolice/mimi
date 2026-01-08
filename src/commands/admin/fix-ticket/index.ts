import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  PermissionFlagsBits,
  TextChannel,
} from "discord.js";
import { Command, Services, Databases } from "../../../interfaces/Command";
import logger from "../../../utils/logger";
import { logChannelPermissions } from "../../../utils/ticketDebug";

const data = new SlashCommandBuilder()
  .setName("fix-ticket")
  .setDescription("Fix a stuck ticket channel (Admin only)")
  .addChannelOption((option) =>
    option
      .setName("channel")
      .setDescription("The ticket channel to fix")
      .setRequired(true)
  )
  .addStringOption((option) =>
    option
      .setName("action")
      .setDescription("Action to perform")
      .setRequired(true)
      .addChoices(
        { name: "Diagnose - Show current permissions", value: "diagnose" },
        { name: "Force Archive/Delete - Archive or delete channel based on config", value: "archive" },
        { name: "Force Close - Mark as closed in database", value: "close" }
      )
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

async function execute(
  interaction: ChatInputCommandInteraction,
  client: Client,
  { ticketManager, settingsManager }: Services,
  _databases: Databases
): Promise<void> {
  // Only defer if not already deferred or replied
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ ephemeral: true });
  }

  const channel = interaction.options.getChannel("channel", true) as TextChannel;
  const action = interaction.options.getString("action", true);

  if (!interaction.guild) {
    await interaction.editReply("This command can only be used in a server.");
    return;
  }

  try {
    const ticket = await ticketManager.findTicketByChannel(channel.id);

    if (!ticket) {
      await interaction.editReply(
        `Channel ${channel} is not a valid ticket channel.`
      );
      return;
    }

    const settings = await settingsManager.getSettings(interaction.guild.id);

    switch (action) {
      case "diagnose": {
        logChannelPermissions(channel, "Manual Diagnosis");
        
        const overwrites = channel.permissionOverwrites.cache;
        let diagnosis = `**Ticket Diagnosis for ${channel}**\n\n`;
        diagnosis += `**Database Status:** ${ticket.status}\n`;
        diagnosis += `**Owner:** <@${ticket.ownerId}>\n`;
        diagnosis += `**Claimed By:** ${ticket.claimedById ? `<@${ticket.claimedById}>` : "Not claimed"}\n`;
        diagnosis += `**Created:** <t:${Math.floor(new Date(ticket.createdAt).getTime() / 1000)}:R>\n`;
        diagnosis += `**Closed:** ${ticket.closedAt ? `<t:${Math.floor(new Date(ticket.closedAt).getTime() / 1000)}:R>` : "Not closed"}\n\n`;
        diagnosis += `**Permission Overwrites (${overwrites.size}):**\n`;

        if (overwrites.size === 0) {
          diagnosis += "⚠️ No permission overwrites (inheriting from category)\n";
        } else {
          overwrites.forEach((overwrite) => {
            const target = overwrite.type === 0 ? "Role" : "User";
            const targetMention = overwrite.type === 0 ? `<@&${overwrite.id}>` : `<@${overwrite.id}>`;
            diagnosis += `- ${target} ${targetMention}\n`;
            diagnosis += `  Allow: ${overwrite.allow.toArray().join(", ") || "none"}\n`;
            diagnosis += `  Deny: ${overwrite.deny.toArray().join(", ") || "none"}\n`;
          });
        }

        diagnosis += `\n**Archive Category:** ${settings?.archiveCategoryId ? `<#${settings.archiveCategoryId}>` : "Not configured"}`;

        await interaction.editReply(diagnosis);
        return;
      }

      case "archive": {
        const owner = await client.users.fetch(ticket.ownerId);
        const discordService = (ticketManager as any).discordService;
        const channelName = channel.name;
        const channelId = channel.id;

        if (settings?.archiveCategoryId) {
          await discordService.archiveTicketChannel(channel, owner, settings);
          await interaction.editReply(
            `Successfully archived ${channel}. Check the logs for details.`
          );
        } else {
          // Reply BEFORE deleting since the channel will be gone
          await interaction.editReply(
            `Deleting #${channelName} (${channelId})...`
          );
          await discordService.deleteTicketChannel(channel, owner);
        }
        return;
      }

      case "close": {
        if (ticket.status === "CLOSED") {
          await interaction.editReply(
            `Ticket ${channel} is already marked as closed in the database.`
          );
          return;
        }

        const ticketRepository = (ticketManager as any).ticketRepository;
        await ticketRepository.closeTicket(channel.id, {
          closedById: interaction.user.id,
          closeReason: "Force closed by administrator",
        });

        await interaction.editReply(
          `Ticket ${channel} has been marked as closed in the database. You may want to run "Force Archive/Delete" next.`
        );
        return;
      }

      default:
        await interaction.editReply("Invalid action specified.");
        return;
    }
  } catch (error: any) {
    logger.error(`Error in fix-ticket command:`, error);
    await interaction.editReply(
      `An error occurred: ${error.message || "Unknown error"}`
    );
  }
}

export const command: Command = {
  data,
  execute,
};
