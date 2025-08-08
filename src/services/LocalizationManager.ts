import { readdirSync, existsSync } from "fs";
import path from "path";
import logger from "../utils/logger";

export class LocalizationManager {
  private localizations: Map<string, Record<string, any>> = new Map();

  constructor() {
    this.loadAllLocalizations();
    this.loadGlobalLocalizations();
  }

  private loadGlobalLocalizations(): void {
    const localesPath = path.join(__dirname, "../locales");
    if (existsSync(localesPath)) {
      const localeFiles = readdirSync(localesPath).filter((file) =>
        file.endsWith(".json")
      );
      for (const file of localeFiles) {
        const lang = file.replace(".json", "");
        const translations = require(path.join(localesPath, file));

        let existing = this.localizations.get("global");
        if (!existing) {
          existing = {};
          this.localizations.set("global", existing);
        }
        existing[lang] = translations;
      }
    }
  }

  private loadAllLocalizations(): void {
    const commandsBasePath = path.join(__dirname, "../commands");
    logger.info("Pre-loading all localizations...");
    // Only scan command directories, excluding help_docs
    const commandCategories = readdirSync(commandsBasePath, {
      withFileTypes: true,
    })
      .filter((dirent) => dirent.isDirectory() && dirent.name !== "help_docs")
      .map((dirent) => dirent.name);

    for (const category of commandCategories) {
      const categoryPath = path.join(commandsBasePath, category);
      const commandFolders = readdirSync(categoryPath, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => dirent.name);

      for (const commandName of commandFolders) {
        const localesPath = path.join(categoryPath, commandName, "locales");
        if (existsSync(localesPath)) {
          const localeFiles = readdirSync(localesPath).filter((file) =>
            file.endsWith(".json")
          );
          for (const file of localeFiles) {
            const lang = file.replace(".json", "");
            const translations = require(path.join(localesPath, file));
            const commandKey = `${commandName}_${lang}`;

            // This logic seems a bit off, let's adjust to store by command name
            // and have nested languages. But for now, let's stick to the user's request structure
            // to get things working first. A better structure would be:
            // this.localizations.set(commandName, { [lang]: translations });
            // For now, let's assume we retrieve the whole object for a command.

            let existing = this.localizations.get(commandName);
            if (!existing) {
              existing = {};
              this.localizations.set(commandName, existing);
            }
            existing[lang] = translations;
          }
        }
      }
    }
    // A more accurate logging based on the corrected logic
    const loadedLangs = Array.from(this.localizations.values()).reduce(
      (acc, langs) => acc + Object.keys(langs).length,
      0
    );
    logger.info(
      `Successfully pre-loaded localizations for ${this.localizations.size} commands across ${loadedLangs} language files.`
    );
  }

  public get(commandName: string): Record<string, any> | undefined {
    return this.localizations.get(commandName);
  }

  // It might be useful to have a method to get a specific language
  public getLocale(commandName: string, lang: string): any | undefined {
    const commandLocales = this.get(commandName);
    return commandLocales ? commandLocales[lang] : undefined;
  }
}
