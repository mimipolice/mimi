import { Kysely } from "kysely";
import NodeCache from "node-cache";
import logger from "../utils/logger";
import { DB } from "../shared/database/types";

export interface GuildSettings {
  guildId: string;
  panelChannelId: string | null;
  ticketCategoryId: string | null;
  logChannelId: string | null;
  staffRoleId: string | null;
  archiveCategoryId: string | null;
  panelTitle: string | null;
  panelDescription: string | null;
  panelAuthorIconUrl: string | null;
  panelThumbnailUrl: string | null;
  panelFooterIconUrl: string | null;
}

export class SettingsManager {
  private db: Kysely<DB>;
  private cache: NodeCache;

  constructor(db: Kysely<DB>) {
    this.db = db;
    this.cache = new NodeCache({ stdTTL: 600 }); // Cache for 10 minutes
  }

  async getSettings(guildId: string): Promise<GuildSettings | null> {
    const cachedSettings = this.cache.get<GuildSettings>(guildId);
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
        this.cache.set(guildId, settings);
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
        this.cache.set(guildId, newSettings);
        return newSettings;
      }
      return null;
    } catch (error) {
      logger.error(`Error updating settings for guild ${guildId}:`, error);
      return null;
    }
  }

  clearCache(guildId: string) {
    this.cache.del(guildId);
  }
}
