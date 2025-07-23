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

function findCommandDir(
  commandName: string,
  dir: string = path.join(__dirname, "..", "commands")
): string | null {
  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      if (item.name === commandName) {
        return fullPath;
      }
      const foundPath = findCommandDir(commandName, fullPath);
      if (foundPath) {
        return foundPath;
      }
    }
  }

  return null;
}
