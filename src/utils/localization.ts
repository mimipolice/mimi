import { LocalizationManager } from "../services/LocalizationManager";

export function getLocalizations(
  localizationManager: LocalizationManager,
  commandName: string
): Record<string, any> {
  return localizationManager.get(commandName) || {};
}
