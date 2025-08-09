import { Message, EmbedBuilder, TextChannel, ChannelType } from "discord.js";
import {
  getSolutionsByTag,
  getAllTags,
} from "../../../repositories/forum.repository";
import { mimiDLCDb } from "../../../shared/database";
import { MessageCommand } from "../../../interfaces/MessageCommand";
import config from "../../../config";
import logger from "../../../utils/logger";

const QcCommand: MessageCommand = {
  name: "qc",
  aliases: ["?qc"],
  async execute(message: Message, args: string[]) {
    if (
      message.channel.type !== ChannelType.GuildText &&
      message.channel.type !== ChannelType.GuildAnnouncement &&
      message.channel.type !== ChannelType.PublicThread &&
      message.channel.type !== ChannelType.PrivateThread
    ) {
      return;
    }
    if (message.guild?.id !== config.discord.guildId) return;
    const tag = args[0];
    const numberArg = args[1];

    if (!tag) {
      const allTags = await getAllTags(mimiDLCDb);
      if (allTags.length === 0) {
        await message.reply("❌ No solution tags found on this server.");
        return;
      }
      const embed = new EmbedBuilder()
        .setTitle("Available Solution Tags")
        .setDescription(allTags.map((t) => `- ${t}`).join("\n"))
        .setColor("Blurple");
      await message.reply({ embeds: [embed] });
      return;
    }

    const solutions = await getSolutionsByTag(mimiDLCDb, tag);

    if (solutions.length === 0) {
      await message.reply(`❌ No solutions found with the tag \`${tag}\``);
      return;
    }

    // Sort solutions to ensure consistent ordering
    solutions.sort((a, b) => a.thread_id.localeCompare(b.thread_id));

    if (!numberArg) {
      // List all solutions for the tag
      const response = solutions
        .map((solution, index) => {
          const channel = message.guild?.channels.cache.get(solution.thread_id);
          if (channel) {
            return `${index + 1}. [${
              channel.name
            }](<https://discord.com/channels/${message.guild?.id}/${
              solution.thread_id
            }>)`;
          }
          return null;
        })
        .filter(Boolean)
        .join("\n");

      const embed = new EmbedBuilder()
        .setTitle(`Solutions for tag \`${tag}\``)
        .setDescription(
          response || "❌ Could not find any channels for the solutions."
        )
        .setColor("Blurple");

      await message.reply({ embeds: [embed] });
    } else {
      // A specific solution is requested
      const number = parseInt(numberArg, 10);
      if (isNaN(number) || number < 1 || number > solutions.length) {
        await message.reply(
          `❌ Invalid number. Please provide a number between 1 and ${solutions.length}.`
        );
        return;
      }

      const selectedSolution = solutions[number - 1];

      try {
        const threadChannel = await message.client.channels.fetch(
          selectedSolution.thread_id
        );

        if (
          threadChannel &&
          threadChannel.isThread() &&
          threadChannel.isTextBased()
        ) {
          // 1. Send mention notification to the source thread
          await threadChannel.send(
            `-# User ${message.author.username} mentioned this post in ${message.url}`
          );

          // 2. Forward the solution message to the command channel, as a reply
          const solutionMessage = await threadChannel.messages.fetch(
            selectedSolution.message_id
          );

          // Following the pattern from MessageForwardingService: reply first, then forward.
          await message.reply({
            content: `_ _`,
            allowedMentions: { repliedUser: false },
          });
          await solutionMessage.forward(message.channel);
        } else {
          await message.reply(
            "❌ Could not find the solution thread or it's not a text-based thread."
          );
        }
      } catch (error) {
        logger.error(
          `Error handling qc command with number for tag '${tag}':`,
          error
        );
        await message.reply(
          "❌ An error occurred while fetching the solution."
        );
      }
    }
  },
};

export default QcCommand;
