import fs from "fs";
import path from "path";

export function getLocalizations(commandName: string): Record<string, any> {
  const commandDir = findCommandDir(commandName);
  if (!commandDir) {
    throw new Error(`Could not find directory for command ${commandName}`);
  }

  const localesPath = path.join(commandDir, "locales");
  if (!fs.existsSync(localesPath)) {
    return {};
  }

  const localeFiles = fs.readdirSync(localesPath);
  const translations: Record<string, any> = {};

  for (const file of localeFiles) {
    if (file.endsWith(".json")) {
      const locale = file.replace(".json", "");
      const filePath = path.join(localesPath, file);
      const fileContent = fs.readFileSync(filePath, "utf-8");
      translations[locale] = JSON.parse(fileContent);
    }
  }

  return translations;
}

function findCommandDir(commandName: string): string | null {
  const commandsBasePath = path.join(__dirname, "..", "commands");
  const categories = fs.readdirSync(commandsBasePath);

  for (const category of categories) {
    const categoryPath = path.join(commandsBasePath, category);
    if (fs.statSync(categoryPath).isDirectory()) {
      const commandPath = path.join(categoryPath, commandName);
      if (
        fs.existsSync(commandPath) &&
        fs.statSync(commandPath).isDirectory()
      ) {
        return commandPath;
      }
    }
  }

  return null;
}
