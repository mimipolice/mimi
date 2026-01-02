import { Interaction, Locale } from "discord.js";

/**
 * Get the locale from an interaction, with fallback to en-US.
 * Maps Discord's locale codes to our supported locales.
 */
export function getInteractionLocale(interaction: Interaction): string {
  const discordLocale = interaction.locale;

  // Map Discord locales to our supported locales
  switch (discordLocale) {
    case Locale.ChineseTW:
      return "zh-TW";
    case Locale.EnglishUS:
    case Locale.EnglishGB:
    default:
      return "en-US";
  }
}
