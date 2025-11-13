import { Interaction, Client } from "discord.js";
import retry from "async-retry";
import { Command, Services, Databases } from "../interfaces/Command";
import logger from "../utils/logger";
import { errorHandler } from "../utils/errorHandler";
import { handleHelpInteraction } from "./handlers/helpInteractionHandler";
import reportViewHandler from "../interactions/buttons/reportView";

export const name = "interactionCreate";

export async function execute(
  interaction: Interaction,
  client: Client,
  services: Services,
  databases: Databases
) {
  const { gachaDb, ticketDb } = databases;
  logger.debug(
    `Received interaction: ${interaction.type} | Custom ID: ${
      "customId" in interaction ? interaction.customId : "N/A"
    }`
  );
  try {
    if (
      interaction.isMessageComponent() &&
      interaction.customId.startsWith("help:")
    ) {
      return handleHelpInteraction(interaction, services);
    }

    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName) as Command;
      if (!command) return;
      await retry(
        async () => {
          await command.execute(interaction, client, services, databases);
        },
        {
          retries: 3,
          factor: 2,
          minTimeout: 200,
          onRetry: (error: Error, attempt: number) => {
            logger.warn(
              `[DB Retry] Command execution failed on attempt ${attempt}. Retrying...`,
              error.message
            );
          },
        }
      );
      errorHandler.recordSuccessfulCommand(
        client,
        interaction,
        interaction.commandName
      );
    } else if (interaction.isContextMenuCommand()) {
      const command = client.commands.get(interaction.commandName) as Command;
      if (!command) return;
      await command.execute(interaction, client, services, databases);
      errorHandler.recordSuccessfulCommand(
        client,
        interaction,
        interaction.commandName
      );
    } else if (
      interaction.isButton() &&
      interaction.customId.startsWith("report-")
    ) {
      await reportViewHandler.execute(interaction, client, services, databases);
      errorHandler.recordSuccessfulCommand(
        client,
        interaction,
        interaction.customId
      );
    } else if (
      interaction.isButton() &&
      interaction.customId.startsWith("story_confirm:")
    ) {
      const [, threadId, authorId] = interaction.customId.split(":");
      if (interaction.user.id !== authorId) {
        await interaction.reply({
          content: "這不是給您用的按鈕！",
          ephemeral: true,
        });
        return;
      }

      try {
        await services.storyForumService.confirmSubmission(threadId);
        await interaction.update({
          content:
            "✅ 投稿已確認，感謝您的創作！\n\n身為作者，你現在可以使用 `?pin` 和 `?unpin` 指令來管理此貼文中的重要訊息。",
          components: [],
        });
      } catch (error) {
        logger.error(
          `[StoryForum] Failed to confirm submission for thread ${threadId}`,
          error
        );
        await interaction.reply({
          content: "確認時發生錯誤，請聯絡管理員。",
          ephemeral: true,
        });
      }
      errorHandler.recordSuccessfulCommand(
        client,
        interaction,
        interaction.customId
      );
    } else if (interaction.isButton()) {
      const button = client.buttons.find((b) => {
        if (typeof b.name === "string") {
          return interaction.customId.startsWith(b.name);
        } else if (b.name instanceof RegExp) {
          return b.name.test(interaction.customId);
        }
        return false;
      });
      if (!button) return;
      await button.execute(interaction, client, services, databases);
      errorHandler.recordSuccessfulCommand(
        client,
        interaction,
        interaction.customId
      );
    } else if (interaction.isModalSubmit()) {
      const modal = client.modals.find((m) => {
        if (typeof m.name === "string") {
          return interaction.customId.startsWith(m.name);
        }
        return false;
      });
      if (!modal) return;
      await modal.execute(interaction, services, databases);
      errorHandler.recordSuccessfulCommand(
        client,
        interaction,
        interaction.customId
      );
    } else if (interaction.isStringSelectMenu()) {
      const menu = client.selectMenus.find((m) => {
        if (typeof m.name === "string") {
          return interaction.customId.startsWith(m.name);
        }
        return false;
      });
      if (!menu) return;
      await menu.execute(interaction, services, databases);
      errorHandler.recordSuccessfulCommand(
        client,
        interaction,
        interaction.customId
      );
    } else if (interaction.isAutocomplete()) {
      const command = client.commands.get(interaction.commandName);
      if (!command || !command.autocomplete) return;
      await command.autocomplete(interaction, gachaDb, ticketDb);
      // No success recording for autocomplete
    }
  } catch (error) {
    errorHandler.handleInteractionError(interaction, error, client, services);
  }
}
