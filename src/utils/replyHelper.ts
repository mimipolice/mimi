import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  InteractionReplyOptions,
  MessageFlags,
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

  const embed = new EmbedBuilder()
    .setAuthor({
      name: typeLocale.author || "Error",
      iconURL: config.resources.images.close,
    })
    .setColor(0xed4245); // Red color as a default

  if (typeLocale.description) {
    let description = typeLocale.description;
    if (replacements) {
      for (const key in replacements) {
        description = description.replace(
          `{${key}}`,
          String(replacements[key])
        );
      }
    }
    embed.setDescription(description);
    embed.setTimestamp();
  }

  if (typeLocale.footer) {
    embed.setFooter({ text: typeLocale.footer });
  }

  if (type === "cooldown") {
    embed.setAuthor({
      name: typeLocale.author || "Cooldown",
      iconURL: config.resources.images.sandClock,
    });
    embed.setThumbnail(config.resources.images.thumbnail);
    embed.setColor(0x5865f2); // Blurple
    embed.setTimestamp();
  } else if (type === "internalError" || type === "discordError") {
    embed.setThumbnail(config.resources.images.thumbnail);
    embed.setTimestamp();
  } else if (type === "unauthorized" || type === "missingPermissions") {
    embed.setThumbnail(config.resources.images.thumbnail);
  } else if (type === "businessError") {
    embed.setColor(0xfaa61a); // Yellow-ish
  }

  const components = [];
  if ((type === "internalError" || type === "discordError") && localizations) {
    const supportButton = new ButtonBuilder()
      .setLabel(localizations.supportServer || "Support Server")
      .setURL(config.resources.links.supportServer)
      .setStyle(ButtonStyle.Link);
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      supportButton
    );
    components.push(row);
  }

  return { embeds: [embed], components, flags: MessageFlags.Ephemeral };
}
