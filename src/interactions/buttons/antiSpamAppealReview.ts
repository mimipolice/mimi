import { ButtonInteraction, Client, EmbedBuilder } from "discord.js";
import { Button } from "../../interfaces/Button";

const appealReviewButton: Button = {
  name: /^(appeal_approve|appeal_deny):(\d+):(\d+)$/,
  execute: async (interaction: ButtonInteraction, client: Client) => {
    const [action, userId, guildId] = interaction.customId.split(":");

    const guild = await client.guilds.fetch(guildId);
    if (!guild) {
      await interaction.reply({ content: "Guild not found.", ephemeral: true });
      return;
    }

    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) {
      await interaction.reply({
        content: "Member not found in this guild.",
        ephemeral: true,
      });
      return;
    }

    const originalEmbed = interaction.message.embeds[0];
    const newEmbed = new EmbedBuilder(originalEmbed.toJSON());

    if (action === "appeal_approve") {
      try {
        await member.timeout(null, "Appeal approved by administrator.");
        await member
          .send(
            "Your appeal has been approved, and your timeout has been removed."
          )
          .catch(() => {
            console.log(`Could not DM user ${userId}`);
          });
        newEmbed
          .setTitle("Appeal Approved")
          .setColor("Green")
          .addFields({
            name: "Moderator",
            value: interaction.user.toString(),
            inline: true,
          });
      } catch (error) {
        console.error(error);
        await interaction.reply({
          content: "Failed to remove timeout.",
          ephemeral: true,
        });
        return;
      }
    } else if (action === "appeal_deny") {
      try {
        await member.send("Your appeal has been denied.").catch(() => {
          console.log(`Could not DM user ${userId}`);
        });
        newEmbed
          .setTitle("Appeal Denied")
          .setColor("Red")
          .addFields({
            name: "Moderator",
            value: interaction.user.toString(),
            inline: true,
          });
      } catch (error) {
        console.error(error);
      }
    }

    await interaction.message.edit({ embeds: [newEmbed], components: [] });
    await interaction.reply({
      content: `The appeal has been ${
        action === "appeal_approve" ? "approved" : "denied"
      }.`,
      ephemeral: true,
    });
  },
};

export default appealReviewButton;
