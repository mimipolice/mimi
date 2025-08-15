import { LocalizationManager } from "../services/LocalizationManager";

export function getLocalizations(
  localizationManager: LocalizationManager,
  commandName: string
): Record<string, any> {
  const availableLangs = localizationManager.getAvailableLanguages();
  const localizations: Record<string, any> = {};

  for (const lang of availableLangs) {
    const locale = localizationManager.getLocale(commandName, lang);
    if (locale) {
      localizations[lang] = locale;
    }
  }

  return localizations;
}
