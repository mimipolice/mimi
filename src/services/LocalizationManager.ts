import { readdirSync, existsSync } from "fs";
import path from "path";
import logger from "../utils/logger";

export class LocalizationManager {
  private localizations: Map<string, Record<string, any>> = new Map();

  constructor() {
    this.loadLocalizations();
  }

  private loadLocalizations(): void {
    const localesPath = path.join(__dirname, "../locales");
    if (!existsSync(localesPath)) {
      logger.warn("Locales directory not found.");
      return;
    }

    const localeFiles = readdirSync(localesPath).filter((file) =>
      file.endsWith(".json")
    );

    for (const file of localeFiles) {
      const lang = file.replace(".json", "");
      try {
        const translations = require(path.join(localesPath, file));
        this.localizations.set(lang, translations);
      } catch (error) {
        logger.error(`Error loading localization file: ${file}`, error);
      }
    }
    logger.info(`Successfully loaded ${this.localizations.size} languages.`);
  }

  public get(
    key: string,
    lang: string,
    options?: Record<string, string | number>
  ): string | undefined {
    const langFile = this.localizations.get(lang);
    if (!langFile) return undefined;

    const keys = key.split(".");
    let current = langFile;
    for (const k of keys) {
      if (current[k]) {
        current = current[k];
      } else {
        return undefined;
      }
    }

    if (typeof current !== "string") return undefined;

    if (options) {
      return Object.entries(options).reduce(
        (acc, [key, value]) =>
          acc.replace(new RegExp(`{{${key}}}`, "g"), String(value)),
        current as string
      );
    }

    return current;
  }

  public getLocale(commandName: string, lang: string): any | undefined {
    const langFile = this.localizations.get(lang);
    if (!langFile) return undefined;

    return langFile.commands?.[commandName];
  }

  public getAvailableLanguages(): string[] {
    return Array.from(this.localizations.keys());
  }
}
