// src/services/LocalizationManager.ts
import fs from "fs";
import path from "path";
import logger from "../utils/logger";

export class LocalizationManager {
  private localizations: Map<string, Record<string, any>> = new Map();

  constructor() {
    this.loadAllLocalizations();
  }

  private loadAllLocalizations(): void {
    const commandsBasePath = path.join(__dirname, "../commands");
    logger.info("Pre-loading all localizations...");
    this.findLocaleFiles(commandsBasePath);
    logger.info(
      `Successfully pre-loaded localizations for ${this.localizations.size} commands.`
    );
  }

  private findLocaleFiles(dir: string): void {
    const items = fs.readdirSync(dir, { withFileTypes: true });

    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        // If the directory name is 'locales', process it
        if (item.name === "locales") {
          const commandName = path.basename(path.dirname(fullPath));
          const commandLocalizations: Record<string, any> = {};

          const localeFiles = fs
            .readdirSync(fullPath)
            .filter((f) => f.endsWith(".json"));
          for (const file of localeFiles) {
            const locale = file.replace(".json", "");
            try {
              const content = fs.readFileSync(
                path.join(fullPath, file),
                "utf-8"
              );
              commandLocalizations[locale] = JSON.parse(content);
            } catch (e) {
              logger.error(
                `Error parsing ${file} for command ${commandName}`,
                e
              );
            }
          }
          this.localizations.set(commandName, commandLocalizations);
        } else {
          // Otherwise, continue searching recursively
          this.findLocaleFiles(fullPath);
        }
      }
    }
  }

  public get(commandName: string): Record<string, any> | undefined {
    return this.localizations.get(commandName);
  }
}
