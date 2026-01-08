import { Kysely } from "kysely";
import { CacheService } from "./CacheService";
import logger from "../utils/logger";
import { MimiDLCDB } from "../shared/database/types";

interface AntiSpamSettings {
  log_channel_id: string;
}

export class AntiSpamSettingsManager {
  private db: Kysely<MimiDLCDB>;
  private cacheService: CacheService;

  constructor(db: Kysely<MimiDLCDB>) {
    this.db = db;
    this.cacheService = CacheService.getInstance();
  }

  async getAntiSpamSettings(guildId: string): Promise<AntiSpamSettings | null> {
    const cachedSettings = await this.cacheService.get<AntiSpamSettings>(
      `antispam:settings:${guildId}`
    );
    if (cachedSettings) {
      return cachedSettings;
    }

    try {
      const settings = await this.db
        .selectFrom("anti_spam_logs")
        .select("log_channel_id")
        .where("guild_id", "=", guildId)
        .executeTakeFirst();

      if (settings) {
        await this.cacheService.set(`antispam:settings:${guildId}`, settings);
        return settings;
      }
      return null;
    } catch (error) {
      logger.error(
        `Error fetching anti-spam settings for guild ${guildId}:`,
        error
      );
      return null;
    }
  }

  async updateAntiSpamSettings(
    guildId: string,
    newSettings: AntiSpamSettings
  ): Promise<void> {
    try {
      await this.db
        .updateTable("anti_spam_logs")
        .set(newSettings)
        .where("guild_id", "=", guildId)
        .execute();
      await this.cacheService.set(`antispam:settings:${guildId}`, newSettings);
    } catch (error) {
      logger.error(
        `Error updating anti-spam settings for guild ${guildId}:`,
        error
      );
    }
  }

  async clearCache(guildId: string): Promise<void> {
    await this.cacheService.del(`antispam:settings:${guildId}`);
  }
}
