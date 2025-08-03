import fs from "fs";
import path from "path";
import logger from "../utils/logger";

export class LocalizationManager {
  private localizations: Map<string, any> = new Map();

  constructor() {
    this.loadLocalizations();
  }

  private loadLocalizations(): void {
    const commandsPath = path.join(__dirname, "../commands");
    try {
      const commandFolders = fs
        .readdirSync(commandsPath, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => dirent.name);

      for (const commandFolder of commandFolders) {
        const commandFolderPath = path.join(commandsPath, commandFolder);
        const commandSubFolders = fs
          .readdirSync(commandFolderPath, { withFileTypes: true })
          .filter((dirent) => dirent.isDirectory())
          .map((dirent) => dirent.name);

        for (const commandName of commandSubFolders) {
          const localesPath = path.join(
            commandFolderPath,
            commandName,
            "locales"
          );
          if (fs.existsSync(localesPath)) {
            const localeFiles = fs
              .readdirSync(localesPath)
              .filter((file) => file.endsWith(".json"));
            const commandLocalizations: { [key: string]: any } = {};

            for (const file of localeFiles) {
              const locale = file.replace(".json", "");
              const filePath = path.join(localesPath, file);
              const fileContent = fs.readFileSync(filePath, "utf-8");
              commandLocalizations[locale] = JSON.parse(fileContent);
            }
            this.localizations.set(commandName, commandLocalizations);
          }
        }
      }
      logger.info("All localizations have been pre-loaded.");
    } catch (error) {
      logger.error("Failed to load localizations:", error);
    }
  }

  public get(commandName: string): any {
    return this.localizations.get(commandName);
  }
}
