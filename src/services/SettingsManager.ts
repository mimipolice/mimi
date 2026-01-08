import { Kysely, Selectable } from "kysely";
import { CacheService } from "./CacheService";
import logger from "../utils/logger";
import { MimiDLCDB } from "../shared/database/types";

export type GuildSettings = Selectable<MimiDLCDB["guild_settings"]>;

export class SettingsManager {
  private db: Kysely<MimiDLCDB>;
  private cacheService: CacheService;

  constructor(db: Kysely<MimiDLCDB>) {
    this.db = db;
    this.cacheService = CacheService.getInstance();
  }

  async getSettings(guildId: string): Promise<GuildSettings | null> {
    const cachedSettings = await this.cacheService.get<GuildSettings>(
      `settings:${guildId}`
    );
    if (cachedSettings) {
      return cachedSettings;
    }

    try {
      const settings = await this.db
        .selectFrom("guild_settings")
        .selectAll()
        .where("guildId", "=", guildId)
        .executeTakeFirst();

      if (settings) {
        await this.cacheService.set(`settings:${guildId}`, settings);
        return settings;
      }
      return null;
    } catch (error) {
      logger.error(`Error fetching settings for guild ${guildId}:`, error);
      return null;
    }
  }

  async updateSettings(
    guildId: string,
    data: Partial<GuildSettings>
  ): Promise<GuildSettings | null> {
    try {
      const newSettings = await this.db
        .insertInto("guild_settings")
        .values({ guildId: guildId, ...data })
        .onConflict((oc) => oc.column("guildId").doUpdateSet(data))
        .returningAll()
        .executeTakeFirst();

      if (newSettings) {
        await this.cacheService.set(`settings:${guildId}`, newSettings);
        return newSettings;
      }
      return null;
    } catch (error) {
      logger.error(`Error updating settings for guild ${guildId}:`, error);
      return null;
    }
  }

  async clearCache(guildId: string) {
    await this.cacheService.del(`settings:${guildId}`);
  }
}
