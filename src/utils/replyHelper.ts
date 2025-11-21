import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  InteractionReplyOptions,
  MessageFlags,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
} from "discord.js";
import { LocalizationManager } from "../services/LocalizationManager";
import config from "../config";
import { GlobalLocale, LocaleStrings } from "../types/locales";

type ReplyType =
  | "unauthorized"
  | "businessError"
  | "checkFailure"
  | "cooldown"
  | "internalError"
  | "autoModBlocked"
  | "discordError"
  | "missingPermissions";

export function createReply(
  localizationManager: LocalizationManager,
  type: ReplyType,
  locale: string,
  replacements?: Record<string, string | number>
): InteractionReplyOptions {
  const localizations = localizationManager.getLocale("global", locale) as
    | GlobalLocale
    | undefined;
  const typeLocale = (localizations?.[type] || {}) as LocaleStrings;

  // Determine color based on error type
  let accentColor = 0xed4245; // Red as default
  if (type === "cooldown") {
    accentColor = 0x5865f2; // Blurple
  } else if (type === "businessError") {
    accentColor = 0xfaa61a; // Yellow-ish
  }

  // Build content with replacements
  let description = typeLocale.description || "An error occurred.";
  if (replacements) {
    for (const key in replacements) {
      description = description.replace(
        `{${key}}`,
        String(replacements[key])
      );
    }
  }

  // Determine icon emoji based on type
  let iconEmoji = "❌"; // Default error icon
  if (type === "cooldown") {
    iconEmoji = "⏳";
  } else if (type === "businessError") {
    iconEmoji = "⚠️";
  } else if (type === "unauthorized" || type === "missingPermissions") {
    iconEmoji = "🔒";
  } else if (type === "internalError" || type === "discordError") {
    iconEmoji = "🔧";
  } else if (type === "autoModBlocked") {
    iconEmoji = "🛡️";
  }

  // Build Components v2 Container
  const container = new ContainerBuilder()
    .setAccentColor(accentColor)
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(`${iconEmoji} **${typeLocale.author || "Error"}**\n\n${description}`)
    );

  // Add footer if present
  if (typeLocale.footer) {
    container
      .addSeparatorComponents(
        new SeparatorBuilder()
          .setSpacing(SeparatorSpacingSize.Small)
          .setDivider(false)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(`*${typeLocale.footer}*`)
      );
  }

  // Add support button for internal/discord errors
  const actionRows = [];
  if ((type === "internalError" || type === "discordError") && localizations) {
    const supportButton = new ButtonBuilder()
      .setLabel(localizations.supportServer || "Support Server")
      .setURL(config.resources.links.supportServer)
      .setStyle(ButtonStyle.Link);
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      supportButton
    );
    actionRows.push(row);
  }

  if (actionRows.length > 0) {
    container.addActionRowComponents(...actionRows);
  }

  return { 
    components: [container], 
    flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2] 
  };
}
