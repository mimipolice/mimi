import { readdirSync, existsSync } from "fs";
import path from "path";
import logger from "../utils/logger";

export interface CommandLocale {
  name?: string;
  description?: string;
  options?: Record<string, { name?: string; description?: string }>;
  [key: string]: unknown;
}

export class LocalizationManager {
  private localizations: Map<string, Record<string, unknown>> = new Map();

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
    let current: unknown = langFile;
    for (const k of keys) {
      if (current && typeof current === "object" && k in current) {
        current = (current as Record<string, unknown>)[k];
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

  /**
   * Get locale data for a specific section (e.g., "global", or a command name under "commands")
   * @param sectionName - The section name ("global" for global strings, or command name for commands)
   * @param lang - The language code (e.g., "zh-TW", "en-US")
   */
  public getLocale(sectionName: string, lang: string): CommandLocale | undefined {
    const langFile = this.localizations.get(lang);
    if (!langFile) return undefined;

    // Check if it's a top-level section (like "global")
    if (sectionName in langFile) {
      return langFile[sectionName] as CommandLocale;
    }

    // Otherwise, look in commands section
    const commands = langFile.commands as Record<string, CommandLocale> | undefined;
    return commands?.[sectionName];
  }

  public getAvailableLanguages(): string[] {
    return Array.from(this.localizations.keys());
  }
}
