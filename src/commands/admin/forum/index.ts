import { Message, PermissionsBitField } from "discord.js";
import { MessageCommand } from "../../../interfaces/MessageCommand";
import { Services } from "../../../interfaces/Command";
import { addTag } from "./add-tag";
import { cleanupTags } from "./cleanup-tags";
import { autotag } from "./autotag";
import { story } from "./story";

const ForumCommand: MessageCommand = {
  name: "forum",
  aliases: ["f"],
  execute: async (
    message: Message,
    args: string[],
    services: Services
  ): Promise<void> => {
    if (
      !message.member?.permissions.has(PermissionsBitField.Flags.Administrator)
    ) {
      await message.reply("You do not have permission to use this command.");
      return;
    }

    const subCommand = args.shift()?.toLowerCase();

    if (!subCommand) {
      await message.reply("Please provide a subcommand. (e.g., add-tag)");
      return;
    }

    switch (subCommand) {
      case "add-tag":
        // @ts-ignore
        await addTag(message, args, services);
        break;
      case "cleanup-tags":
        // @ts-ignore
        await cleanupTags(message, args, services);
        break;
      case "autotag":
        // @ts-ignore
        await autotag(message, args, services);
        break;
      case "story":
        // @ts-ignore
        await story(message, args, services);
        break;
      case "help": {
        const helpMessage = `**Forum Command Usage**
\`?forum <subcommand> [arguments]\`

**Subcommands:**
- \`add-tag <forum_channel_id> <tag_name>\`: Adds a tag to a forum channel.
- \`cleanup-tags <forum_channel_id>\`: Removes all tags from a forum channel.
- \`autotag <set|remove|view> [forum_channel_id] [tag_id]\`: Manages autotagging for forum channels.
- \`story <set|remove|view> [forum_channel_id]\`: Manages story forum channels.
- \`help\`: Shows this help message.`;
        await message.reply(helpMessage);
        break;
      }
      default:
        await message.reply(
          `Unknown subcommand: ${subCommand}. Use \`?forum help\` to see available commands.`
        );
        break;
    }
  },
};

export default ForumCommand;
