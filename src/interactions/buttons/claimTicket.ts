import { MessageFlags } from "discord-api-types/v10";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  EmbedBuilder,
  GuildMember,
  Client,
  ComponentType,
} from "discord.js";
import { mimiDLCDb } from "../../shared/database";
import { Services, Databases } from "../../interfaces/Command"; // Import Services and Databases

export default {
  name: "claim_ticket",
  // Correct the function signature
  execute: async function (
    interaction: ButtonInteraction,
    client: Client,
    services: Services,
    databases: Databases
  ) {
    const { settingsManager } = services; // Destructure from services

    if (!interaction.guild) return;

    const settings = await settingsManager.getSettings(interaction.guild.id);
    const member = interaction.member as GuildMember;

    if (!settings || !settings.staffRoleId) {
      return interaction.reply({
        content: "The staff role has not been configured for this server.",
        flags: MessageFlags.Ephemeral, // Use ephemeral instead of flags
      });
    }

    if (!member.roles.cache.has(settings.staffRoleId)) {
      return interaction.reply({
        content: "You do not have permission to claim this ticket.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const channelId = interaction.channelId;

    // Use the injected database instance for consistency
    const { ticketDb } = databases;
    const ticket = await ticketDb
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

    await ticketDb
      .updateTable("tickets")
      .set({ claimedById: interaction.user.id })
      .where("channelId", "=", channelId)
      .execute();

    const originalMessage = await interaction.channel?.messages.fetch(
      interaction.message.id
    );
    if (originalMessage && originalMessage.embeds.length > 0) {
      const updatedEmbed = new EmbedBuilder(
        originalMessage.embeds[0].toJSON()
      ).addFields({ name: "Claimed by", value: `<@${interaction.user.id}>` });

      // Disable the 'Claim' button after it's been claimed
      const newComponents: ActionRowBuilder<ButtonBuilder>[] = [];
      for (const row of originalMessage.components) {
        if (row.type === ComponentType.ActionRow) {
          const newRow = new ActionRowBuilder<ButtonBuilder>();
          for (const component of row.components) {
            if (component.type === ComponentType.Button) {
              const button = ButtonBuilder.from(component);
              if (component.customId === "claim_ticket") {
                button.setDisabled(true);
              }
              newRow.addComponents(button);
            }
          }
          newComponents.push(newRow);
        }
      }

      await originalMessage.edit({
        embeds: [updatedEmbed],
        components: newComponents,
      });
    }

    return interaction.reply({
      content: "You have claimed this ticket.",
      flags: MessageFlags.Ephemeral,
    });
  },
};
