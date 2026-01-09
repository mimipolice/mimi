import { Interaction, Locale } from "discord.js";

/**
 * Map Discord's locale codes to our supported locales.
 * Defaults to "en-US" if not supported.
 */
export function mapLocale(discordLocale: string): string {
  switch (discordLocale) {
    case Locale.ChineseTW:
      return "zh-TW";
    case Locale.EnglishUS:
    case Locale.EnglishGB:
      return "en-US";
    default:
      // Fallback for other languages to English, 
      // or check if we have a file for it (logic could be extended here)
      return "en-US";
  }
}

/**
 * Get the locale from an interaction, with fallback to en-US.
 */
export function getInteractionLocale(interaction: Interaction): string {
  return mapLocale(interaction.locale);
}
