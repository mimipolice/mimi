import { Kysely } from "kysely";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
  Guild,
  ModalSubmitInteraction,
  TextChannel,
  User,
} from "discord.js";
import { SettingsManager } from "./SettingsManager";
import logger from "../utils/logger";
import { generateTranscript } from "../utils/transcript";
import { sanitize } from "../utils/sanitize";
import { DB } from "../shared/database/types";

export class TicketManager {
  private db: Kysely<DB>;
  private settingsManager: SettingsManager;
  private client: Client;

  constructor(
    db: Kysely<DB>,
    settingsManager: SettingsManager,
    client: Client
  ) {
    this.db = db;
    this.settingsManager = settingsManager;
    this.client = client;
  }

  async create(
    interaction: ButtonInteraction | ModalSubmitInteraction,
    issueDescription?: string,
    ticketType?: string
  ) {
    const guild = interaction.guild as Guild;
    const user = interaction.user as User;

    const settings = await this.settingsManager.getSettings(guild.id);
    if (!settings || !settings.ticketCategoryId || !settings.staffRoleId) {
      return interaction.editReply(
        "The ticket system has not been configured yet."
      );
    }

    const existingTicket = await this.db
      .selectFrom("tickets")
      .selectAll()
      .where("guildId", "=", guild.id)
      .where("ownerId", "=", user.id)
      .where("status", "=", "OPEN")
      .executeTakeFirst();

    if (existingTicket) {
      return interaction.editReply(
        `You already have an open ticket: <#${existingTicket.channelId}>`
      );
    }

    const ticketChannel = await guild.channels.create({
      name: `ticket-${user.username}`,
      type: ChannelType.GuildText,
      parent: settings.ticketCategoryId,
      permissionOverwrites: [
        {
          id: guild.id,
          deny: ["ViewChannel"],
        },
        {
          id: user.id,
          allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"],
        },
        {
          id: settings.staffRoleId,
          allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"],
        },
      ],
    });

    try {
      await this.db
        .insertInto("tickets")
        .values({
          guildId: guild.id,
          channelId: ticketChannel.id,
          ownerId: user.id,
          status: "OPEN",
          createdAt: new Date().toISOString(),
        })
        .execute();
    } catch (error: any) {
      if (error.code === "23503") {
        this.settingsManager.clearCache(interaction.guildId!);
        await interaction.editReply({
          content:
            "A configuration error occurred. The settings cache has been cleared. Please try creating a ticket again. If the issue persists, an administrator may need to run `/config set`.",
        });
        return;
      }
      throw error;
    }

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("close_ticket")
        .setLabel("Close Ticket")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("claim_ticket")
        .setLabel("Claim Ticket")
        .setStyle(ButtonStyle.Success)
    );

    const embed = new EmbedBuilder()
      .setAuthor({
        name: "New Support Ticket",
        iconURL: user.displayAvatarURL(),
      })
      .setDescription(
        `Welcome, <@${user.id}>! A staff member will be with you shortly.`
      )
      .addFields(
        { name: "Type", value: ticketType || "General" },
        {
          name: "Issue",
          value: issueDescription || "No issue description provided.",
        }
      )
      .setTimestamp();

    await ticketChannel.send({
      embeds: [embed],
      components: [row],
    });

    await ticketChannel.send({
      content: `||<@${user.id}><@&${settings.staffRoleId}>||`,
    });

    return interaction.editReply(
      `Your ticket has been created: ${ticketChannel}`
    );
  }

  async close(interaction: ModalSubmitInteraction, reason: string) {
    const guild = interaction.guild as Guild;
    const channel = interaction.channel as TextChannel;

    const ticket = await this.db
      .selectFrom("tickets")
      .selectAll()
      .where("channelId", "=", channel.id)
      .executeTakeFirst();

    if (!ticket) {
      return interaction.editReply("This is not a valid ticket channel.");
    }

    const owner = await this.client.users.fetch(ticket.ownerId);

    // Generate transcript
    const transcriptUrl = await generateTranscript(channel);

    const sanitizedReason = sanitize(reason);
    const openTime = Math.floor(new Date(ticket.createdAt).getTime() / 1000);

    const settings = await this.settingsManager.getSettings(guild.id);
    let logMessageId: string | null = null;
    if (settings && settings.logChannelId) {
      const logChannel = (await guild.channels.fetch(
        settings.logChannelId
      )) as TextChannel;

      const embed = new EmbedBuilder()
        .setTitle("Ticket Closed")
        .setColor(0x32a852)
        .setTimestamp()
        .addFields(
          {
            name: "<:id:1395852626360275166> Ticket ID",
            value: ticket.id.toString(),
            inline: true,
          },
          {
            name: "<:open:1395852835266236547> Opened By",
            value: `<@${owner.id}>`,
            inline: true,
          },
          {
            name: "<:close:1395852886596128818> Closed By",
            value: `<@${interaction.user.id}>`,
            inline: true,
          },
          {
            name: "<:opentime:1395852963079000106> Open Time",
            value: `<t:${openTime}:f>`,
            inline: true,
          },
          {
            name: "<:claim:1395853067357786202> Claimed By",
            value: ticket.claimedById
              ? `<@${ticket.claimedById}>`
              : "Not claimed",
            inline: true,
          },
          { name: "​", value: "‎", inline: true },
          {
            name: "<:reason:1395853176841834516> Reason",
            value: sanitizedReason || "No reason specified",
            inline: false,
          }
        );

      const components = [];
      if (transcriptUrl) {
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setLabel("View Transcript")
            .setStyle(ButtonStyle.Link)
            .setURL(transcriptUrl)
        );
        components.push(row);
      }

      const logMessage = await logChannel.send({ embeds: [embed], components });
      logMessageId = logMessage.id;
    }

    await this.db
      .updateTable("tickets")
      .set({
        status: "CLOSED",
        closeReason: sanitizedReason,
        closedById: interaction.user.id,
        closedAt: new Date().toISOString(),
        transcriptUrl: transcriptUrl,
        logMessageId: logMessageId,
      })
      .where("channelId", "=", channel.id)
      .execute();

    await channel.permissionOverwrites.edit(owner.id, { ViewChannel: false });
    await channel.permissionOverwrites.edit(guild.roles.everyone, {
      ViewChannel: false,
    });

    if (settings && settings.archiveCategoryId) {
      try {
        await channel.setParent(settings.archiveCategoryId);
      } catch (error) {
        logger.warn(
          `Failed to move channel ${channel.id} to archive category.`,
          error
        );
      }
    }

    try {
      const dmEmbed = new EmbedBuilder()
        .setAuthor({ name: guild.name, iconURL: guild.iconURL() || undefined })
        .setTitle("Ticket Closed")
        .setColor(0x32a852)
        .setTimestamp()
        .addFields(
          {
            name: "<:id:1395852626360275166> Ticket ID",
            value: ticket.id.toString(),
            inline: true,
          },
          {
            name: "<:open:1395852835266236547> Opened By",
            value: `<@${owner.id}>`,
            inline: true,
          },
          {
            name: "<:close:1395852886596128818> Closed By",
            value: `<@${interaction.user.id}>`,
            inline: true,
          },
          {
            name: "<:opentime:1395852963079000106> Open Time",
            value: `<t:${openTime}:f>`,
            inline: true,
          },
          {
            name: "<:claim:1395853067357786202> Claimed By",
            value: ticket.claimedById
              ? `<@${ticket.claimedById}>`
              : "Not claimed",
            inline: true,
          },
          { name: "​", value: "‎", inline: true },
          {
            name: "<:reason:1395853176841834516> Reason",
            value: sanitizedReason || "No reason specified",
            inline: false,
          }
        );

      const components = [];
      if (transcriptUrl) {
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setLabel("View Transcript")
            .setStyle(ButtonStyle.Link)
            .setURL(transcriptUrl)
        );
        components.push(row);
      }

      await owner.send({ embeds: [dmEmbed], components });
    } catch (error) {
      logger.warn(`Could not DM user ${owner.id}`, error);
    }

    return interaction.editReply("Ticket closed.");
  }
}
