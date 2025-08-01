import {
  ButtonInteraction,
  EmbedBuilder,
  GuildMember,
  Client,
} from "discord.js";
import { mimiDLCDb } from "../../shared/database";
import { SettingsManager } from "../../services/SettingsManager";
import { TicketManager } from "../../services/TicketManager";
import { MessageFlags } from "discord-api-types/v10";

export default {
  name: "claim_ticket",
  execute: async function (
    interaction: ButtonInteraction,
    _client: Client,
    settingsManager: SettingsManager,
    _ticketManager: TicketManager
  ) {
    if (!interaction.guild || !settingsManager) return;

    const settings = await settingsManager.getSettings(interaction.guild.id);
    const member = interaction.member as GuildMember;

    if (!settings || !settings.staffRoleId) {
      return interaction.reply({
        content: "The staff role has not been configured for this server.",
        flags: MessageFlags.Ephemeral,
      });
    }

    if (!member.roles.cache.has(settings.staffRoleId)) {
      return interaction.reply({
        content: "You do not have permission to claim this ticket.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const channelId = interaction.channelId;

    const ticket = await mimiDLCDb
      .selectFrom("tickets")
      .selectAll()
      .where("channelId", "=", channelId)
      .executeTakeFirst();

    if (ticket?.claimedById) {
      return interaction.reply({
        content: "This ticket has already been claimed.",
        flags: MessageFlags.Ephemeral,
      });
    }

    await mimiDLCDb
      .updateTable("tickets")
      .set({ claimedById: interaction.user.id })
      .where("channelId", "=", channelId)
      .execute();

    const originalMessage = await interaction.channel?.messages.fetch(
      interaction.message.id
    );
    if (originalMessage) {
      const updatedEmbed = new EmbedBuilder(
        originalMessage.embeds[0].toJSON()
      ).addFields({ name: "Claimed by", value: `<@${interaction.user.id}>` });

      await originalMessage.edit({ embeds: [updatedEmbed] });
    }

    return interaction.reply({
      content: "You have claimed this ticket.",
      flags: MessageFlags.Ephemeral,
    });
  },
};
