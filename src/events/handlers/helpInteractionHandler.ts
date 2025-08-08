import { GuildMember, MessageComponentInteraction } from "discord.js";
import { createUnauthorizedReply } from "../../utils/interactionReply";
import { Services } from "../../interfaces/Command";
import {
  buildHelpEmbed,
  HelpState,
} from "../../commands/utility/help/helpEmbedBuilder";
import logger from "../../utils/logger";

export async function handleHelpInteraction(
  interaction: MessageComponentInteraction,
  services: Services
) {
  await interaction.deferUpdate();

  const { helpService } = services;
  const member =
    interaction.member instanceof GuildMember ? interaction.member : null;
  const parts = interaction.customId.split(":");
  const originalUserId = parts.length > 2 ? parts[parts.length - 1] : null;

  if (originalUserId && interaction.user.id !== originalUserId) {
    await interaction.followUp(createUnauthorizedReply(interaction));
    return;
  }

  const [, action] = parts;

  // Determine language from the interaction if possible, otherwise default
  let lang: "zh-TW" | "en-US" = interaction.locale.startsWith("zh")
    ? "zh-TW"
    : "en-US";

  // If a language button was clicked, it dictates the new language
  if (action === "lang") {
    lang = parts[2] as "zh-TW" | "en-US";
  } else if (interaction.isMessageComponent()) {
    // Try to find the lang from the *other* button to preserve state
    const langButton = interaction.message.components
      .flatMap((row: any) => row.components)
      .find((c: any) => c.customId?.startsWith("help:lang:"));
    if (langButton?.customId) {
      // The button shows the lang to switch TO, so we take the opposite
      lang = langButton.customId.split(":")[2] === "en-US" ? "zh-TW" : "en-US";
    }
  }

  let currentState: HelpState = { lang };

  if (interaction.isButton()) {
    if (action === "home") {
      currentState.view = "home";
    } else if (action === "lang") {
      currentState.lang = parts[2] as "zh-TW" | "en-US";
      currentState.view = (parts[3] as any) || "home";
      currentState.category = parts[4] || undefined;
      currentState.command = parts[5] || undefined;
    }
  }

  if (interaction.isStringSelectMenu()) {
    const value = interaction.values[0];
    if (action === "category_select") {
      currentState.view = "category";
      currentState.category = value;
    } else if (action === "command_select") {
      currentState.view = "command";
      currentState.category = parts[2];
      currentState.command = value;
    }
  }

  try {
    const payload = await buildHelpEmbed(
      currentState,
      helpService,
      member,
      services,
      interaction.user.id
    );
    await interaction.editReply({
      components: [payload.container, ...payload.components],
      files: payload.files,
    });
  } catch (error) {
    logger.error("Error updating help embed:", error);
    await interaction.editReply({
      content: "An error occurred while updating the help menu.",
      embeds: [],
      components: [],
    });
  }
}
