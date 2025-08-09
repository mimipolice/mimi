import { Message, EmbedBuilder } from "discord.js";
import { getSolutionsByTag } from "../../../repositories/forum.repository";
import { mimiDLCDb } from "../../../shared/database";
import { MessageCommand } from "../../../interfaces/MessageCommand";
import config from "../../../config";

const QcCommand: MessageCommand = {
  name: "qc",
  aliases: ["?qc"],
  async execute(message: Message, args: string[]) {
    if (message.guild?.id !== config.discord.guildId) return;
    const tag = args[0];
    if (!tag) {
      await message.reply("❌ Please provide a tag to search for.");
      return;
    }

    const solutions = await getSolutionsByTag(mimiDLCDb, tag);

    if (solutions.length === 0) {
      await message.reply(`❌ No solutions found with the tag "${tag}".`);
      return;
    }

    const response = solutions
      .map((solution) => {
        const channel = message.guild?.channels.cache.get(solution.thread_id);
        if (channel) {
          return `-# - [${channel.name}](<https://discord.com/channels/${message.guild?.id}/${solution.thread_id}>)`;
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");

    const embed = new EmbedBuilder()
      .setTitle(`Solutions for tag "${tag}"`)
      .setDescription(
        response || "❌ Could not find any channels for the solutions."
      )
      .setColor("Blurple");

    await message.reply({ embeds: [embed] });
  },
};

export default QcCommand;
