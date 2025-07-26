import { Kysely } from "kysely";
import NodeCache from "node-cache";
import logger from "../utils/logger";
import { MimiDLCDB } from "../shared/database/types";

interface AntiSpamSettings {
  log_channel_id: string;
}

export class AntiSpamSettingsManager {
  private db: Kysely<MimiDLCDB>;
  private cache: NodeCache;

  constructor(db: Kysely<MimiDLCDB>) {
    this.db = db;
    this.cache = new NodeCache({ stdTTL: 600 }); // Cache for 10 minutes
  }

  async getSettings(guildId: string): Promise<AntiSpamSettings | null> {
    const cachedSettings = this.cache.get<AntiSpamSettings>(guildId);
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
        this.cache.set(guildId, settings);
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
}
