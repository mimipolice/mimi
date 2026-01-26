import { Kysely } from "kysely";
import {
  ButtonInteraction,
  ModalSubmitInteraction,
  TextChannel,
  User,
} from "discord.js";
import { SettingsManager, GuildSettings } from "./SettingsManager";
import logger from "../utils/logger";
import { generateTranscript } from "../utils/transcript/transcript";
import { sanitize } from "../utils/sanitize";
import { MimiDLCDB } from "../shared/database/types";
import { TicketRepository, Ticket, getTicketTypeByTypeId } from "../repositories/ticket.repository";
import { TicketStatus } from "../types/ticket";
import { DiscordService } from "./DiscordService";
import {
  BusinessError,
  CustomCheckError,
  MissingPermissionsError,
} from "../errors";
import { GuildMember } from "discord.js";

export class TicketManager {
  private db: Kysely<MimiDLCDB>;
  private settingsManager: SettingsManager;
  private discordService: DiscordService;
  private ticketRepository: TicketRepository;

  constructor(
    db: Kysely<MimiDLCDB>,
    settingsManager: SettingsManager,
    discordService: DiscordService
  ) {
    this.db = db;
    this.settingsManager = settingsManager;
    this.discordService = discordService;
    this.ticketRepository = new TicketRepository(db);
  }

  async create(
    interaction: ButtonInteraction | ModalSubmitInteraction,
    issueDescription?: string,
    ticketType?: string
  ) {
    if (!interaction.inGuild() || !interaction.guild) {
      return interaction.editReply(
        "This command can only be used in a server."
      );
    }

    const guild = interaction.guild;
    const user = interaction.user;

    try {
      const settings = await this._validateAndGetSettings(guild.id);
      await this._checkForExistingTicket(guild.id, user.id);

      const newGuildTicketId = await this.ticketRepository.getNextGuildTicketId(
        guild.id
      );

      const channel = await this.discordService.createTicketChannel(
        guild,
        user,
        settings,
        newGuildTicketId
      );

      await this.ticketRepository.createTicket({
        guildId: guild.id,
        channelId: channel.id,
        ownerId: user.id,
        guildTicketId: newGuildTicketId,
        openReason: issueDescription,
        typeId: ticketType,
      });

      let ticketTypeLabel: string | undefined;
      let ticketTypeEmoji: string | null | undefined;
      if (ticketType) {
        const typeInfo = await getTicketTypeByTypeId(guild.id, ticketType);
        ticketTypeLabel = typeInfo?.label;
        ticketTypeEmoji = typeInfo?.emoji;
      }

      await this.discordService.sendInitialMessages(
        channel,
        user,
        settings,
        ticketTypeLabel,
        issueDescription,
        ticketTypeEmoji
      );

      return interaction.editReply(`Your ticket has been created: ${channel}`);
    } catch (error: any) {
      logger.error("Error creating ticket:", error);
      if (error.code === "23503") {
        this.settingsManager.clearCache(interaction.guildId!);
        return interaction.editReply({
          content:
            "A configuration error occurred. The settings cache has been cleared. Please try creating a ticket again. If the issue persists, an administrator may need to run `/config set`.",
        });
      }
      return interaction.editReply(
        error.message ||
        "An unexpected error occurred while creating your ticket."
      );
    }
  }

  async close(interaction: ModalSubmitInteraction, reason: string) {
    if (!interaction.inGuild() || !interaction.channel || !interaction.guild) {
      return interaction.editReply(
        "This command can only be used in a ticket channel."
      );
    }

    const guild = interaction.guild;
    const channel = interaction.channel as TextChannel;

    try {
      const ticket = await this._validateTicketChannel(channel.id);
      const owner = await this.discordService.fetchUser(ticket.ownerId);
      const settings = await this.settingsManager.getSettings(guild.id);
      const sanitizedReason = sanitize(reason);

      // Get ticket type info for log display
      let ticketTypeLabel: string | undefined;
      let ticketTypeEmoji: string | null | undefined;
      if (ticket.typeId) {
        const typeInfo = await getTicketTypeByTypeId(guild.id, ticket.typeId);
        ticketTypeLabel = typeInfo?.label;
        ticketTypeEmoji = typeInfo?.emoji;
      }

      // Generate transcript
      const transcriptUrl = await generateTranscript(channel);

      // Send log message
      if (settings?.logChannelId) {
        try {
          const logMessageId = await this.discordService.sendLogMessage(
            guild,
            settings.logChannelId,
            ticket,
            owner,
            interaction.user,
            sanitizedReason,
            transcriptUrl,
            ticketTypeLabel,
            ticketTypeEmoji
          );
          if (logMessageId) {
            await this.db
              .updateTable("tickets")
              .set({ logMessageId: logMessageId })
              .where("id", "=", ticket.id)
              .execute();
          }
        } catch (error) {
          logger.error(`Failed to send log message for ticket ${ticket.id}:`, error);
          // Continue even if logging fails
        }
      }

      // CRITICAL: Update database status BEFORE deleting/archiving
      // This ensures the ticket is marked as closed even if channel operation fails
      await this.ticketRepository.closeTicket(channel.id, {
        closedById: interaction.user.id,
        closeReason: sanitizedReason,
        transcriptUrl: transcriptUrl || undefined,
      });
      logger.info(`Ticket ${ticket.id} marked as closed in database`);

      // Send DM notification (non-critical, must be done before channel deletion)
      try {
        await this.discordService.sendDMOnClose(
          guild,
          ticket,
          owner,
          interaction.user,
          sanitizedReason,
          transcriptUrl,
          ticketTypeLabel,
          ticketTypeEmoji
        );
      } catch (dmError) {
        logger.warn(`Failed to send DM to user ${owner.id} for ticket ${ticket.id}:`, dmError);
        // Continue - DM failure is not critical
      }

      // Archive or delete channel based on config
      try {
        if (settings?.archiveCategoryId) {
          await this.discordService.archiveTicketChannel(channel, owner, settings);
          return interaction.editReply("Ticket closed.");
        } else if (settings) {
          // Settings exist but no archiveCategoryId = intentionally delete mode
          // Safety check: only delete if transcript was saved with a valid URL
          const isValidTranscriptUrl = transcriptUrl &&
            transcriptUrl.trim() !== '' &&
            (transcriptUrl.startsWith('http://') || transcriptUrl.startsWith('https://'));

          if (!isValidTranscriptUrl) {
            logger.warn(`Ticket ${ticket.id}: No valid transcript saved (got: ${transcriptUrl || 'null'}), falling back to archive mode`);
            await this.discordService.archiveTicketChannel(channel, owner, settings);
            return interaction.editReply(
              "Ticket closed. Channel archived (transcript not available, deletion skipped)."
            );
          }
          await interaction.editReply("Ticket closed. Deleting channel...");
          await this.discordService.deleteTicketChannel(channel, owner);
          return;
        } else {
          // settings is null - configuration missing, fallback to safe behavior
          logger.warn(`Ticket ${ticket.id}: Guild ${guild.id} has no settings configured, cannot archive/delete channel`);
          return interaction.editReply(
            "Ticket closed in database, but channel could not be archived/deleted (server not configured). Please contact an administrator."
          );
        }
      } catch (channelError) {
        const action = settings?.archiveCategoryId ? "archiving" : "deleting";
        logger.error(`Failed to ${action} channel ${channel.id}, but ticket is closed in database:`, channelError);
        return interaction.editReply(
          `Ticket closed successfully, but there was an issue ${action} the channel. Please contact an administrator if the channel is still visible.`
        );
      }
    } catch (error: any) {
      logger.error(`Error closing ticket ${channel.id} (by <@${interaction.user.id}> / ${interaction.user.id}):`, error);
      return interaction.editReply(
        error.message ||
        "An unexpected error occurred while closing the ticket."
      );
    }
  }

  public async findTicketByChannel(channelId: string) {
    return this.ticketRepository.findTicketByChannel(channelId);
  }

  async claim(interaction: ButtonInteraction): Promise<any> {
    if (!interaction.inGuild() || !interaction.guild) {
      throw new CustomCheckError("This command can only be used in a server.");
    }

    const member = interaction.member as GuildMember;
    const settings = await this._validateAndGetSettings(interaction.guildId);

    if (
      !settings.staffRoleId ||
      !member.roles.cache.has(settings.staffRoleId)
    ) {
      throw new MissingPermissionsError(
        "You do not have permission to claim this ticket."
      );
    }

    const ticket = await this.ticketRepository.findTicketByChannel(
      interaction.channelId
    );

    if (!ticket) {
      throw new BusinessError("This is not a valid ticket channel.");
    }

    if (ticket.claimedById) {
      throw new BusinessError("This ticket has already been claimed.");
    }

    await this.ticketRepository.claimTicket(
      interaction.channelId,
      interaction.user.id
    );

    return ticket;
  }

  private async _validateAndGetSettings(
    guildId: string
  ): Promise<GuildSettings> {
    const settings = await this.settingsManager.getSettings(guildId);
    if (!settings || !settings.ticketCategoryId || !settings.staffRoleId) {
      throw new Error("The ticket system has not been configured yet.");
    }
    return settings;
  }

  private async _checkForExistingTicket(
    guildId: string,
    userId: string
  ): Promise<void> {
    const existingTicket = await this.ticketRepository.findOpenTicketByOwner(
      guildId,
      userId
    );
    if (existingTicket) {
      throw new Error(
        `You already have an open ticket: <#${existingTicket.channelId}>`
      );
    }
  }

  private async _validateTicketChannel(channelId: string): Promise<Ticket> {
    const ticket = await this.ticketRepository.findTicketByChannel(channelId);
    if (!ticket) {
      throw new Error("This is not a valid ticket channel.");
    }
    if (ticket.status === TicketStatus.CLOSED) {
      throw new Error("This ticket is already closed.");
    }
    return ticket;
  }

  async purge(guildId: string): Promise<void> {
    await this.ticketRepository.purgeTickets(guildId);
  }

  async addUser(channel: TextChannel, user: User): Promise<void> {
    const ticket = await this.ticketRepository.findTicketByChannel(channel.id);
    if (!ticket) {
      throw new BusinessError("This is not a valid ticket channel.");
    }
    await this.discordService.addUserToChannel(channel, user);
  }

  async removeUser(channel: TextChannel, user: User): Promise<void> {
    const ticket = await this.ticketRepository.findTicketByChannel(channel.id);
    if (!ticket) {
      throw new BusinessError("This is not a valid ticket channel.");
    }
    await this.discordService.removeUserFromChannel(channel, user);
  }
}
