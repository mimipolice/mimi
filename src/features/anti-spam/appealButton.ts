import {
  ButtonInteraction,
  Client,
  EmbedBuilder,
  TextChannel,
} from "discord.js";
import { Button } from "../../interfaces/Button";
import config from "../../config";
import logger from "../../utils/logger";

const button: Button = {
  name: "appeal",
  execute: async (interaction: ButtonInteraction, client: Client) => {
    await interaction.reply({
      content:
        "Your appeal has been submitted to the administrators. They will review it shortly.",
      ephemeral: true,
    });

    const [, userId, guildId] = interaction.customId.split(":");

    try {
      const guild = await client.guilds.fetch(guildId);
      if (!guild) {
        logger.warn(`[Appeal] Guild ${guildId} not found.`);
        return;
      }

      const appealingUser = await client.users.fetch(userId);
      const adminChannel = await client.channels.fetch(
        config.antiSpam.adminChannelId
      );

      if (!(adminChannel instanceof TextChannel)) {
        logger.error(
          `[Appeal] Admin channel ${config.antiSpam.adminChannelId} is not a text channel.`
        );
        return;
      }

      const appealEmbed = new EmbedBuilder()
        .setTitle("📢 Timeout Appeal")
        .setColor("Yellow")
        .setDescription(
          `User ${appealingUser.toString()} (${
            appealingUser.tag
          }) is appealing their automated timeout.`
        )
        .addFields({
          name: "User ID",
          value: userId,
          inline: true,
        })
        .setTimestamp()
        .setFooter({
          text: `Appeal from ${guild.name}`,
          iconURL: guild.iconURL() || undefined,
        });

      await adminChannel.send({ embeds: [appealEmbed] });
    } catch (error) {
      logger.error(
        `[Appeal] Error processing appeal for user ${userId}:`,
        error
      );
    }
  },
};

export default button;
