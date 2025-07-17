import { Pool } from 'pg';
import NodeCache from 'node-cache';
import logger from '../utils/logger';

interface GuildSettings {
  guildId: string;
  panelChannelId?: string;
  ticketCategoryId?: string;
  logChannelId?: string;
  staffRoleId?: string;
  archiveCategoryId?: string;
}

export class SettingsManager {
  private db: Pool;
  private cache: NodeCache;

  constructor(db: Pool) {
    this.db = db;
    this.cache = new NodeCache({ stdTTL: 600 }); // Cache for 10 minutes
  }

  async getSettings(guildId: string): Promise<GuildSettings | null> {
    const cachedSettings = this.cache.get<GuildSettings>(guildId);
    if (cachedSettings) {
      return cachedSettings;
    }

    try {
      const result = await this.db.query('SELECT * FROM guild_settings WHERE "guildId" = $1', [guildId]);
      if (result.rows.length > 0) {
        const settings = result.rows[0];
        this.cache.set(guildId, settings);
        return settings;
      }
      return null;
    } catch (error) {
      logger.error(`Error fetching settings for guild ${guildId}:`, error);
      return null;
    }
  }

  async updateSettings(guildId: string, data: Partial<GuildSettings>): Promise<GuildSettings | null> {
    const { panelChannelId, ticketCategoryId, logChannelId, staffRoleId, archiveCategoryId } = data;
    try {
      const result = await this.db.query(
        `INSERT INTO guild_settings ("guildId", "panelChannelId", "ticketCategoryId", "logChannelId", "staffRoleId", "archiveCategoryId")
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT ("guildId") DO UPDATE SET
           "panelChannelId" = COALESCE($2, guild_settings."panelChannelId"),
           "ticketCategoryId" = COALESCE($3, guild_settings."ticketCategoryId"),
           "logChannelId" = COALESCE($4, guild_settings."logChannelId"),
           "staffRoleId" = COALESCE($5, guild_settings."staffRoleId"),
           "archiveCategoryId" = COALESCE($6, guild_settings."archiveCategoryId")
         RETURNING *`,
        [guildId, panelChannelId, ticketCategoryId, logChannelId, staffRoleId, archiveCategoryId]
      );
      const newSettings = result.rows[0];
      this.cache.set(guildId, newSettings);
      return newSettings;
    } catch (error) {
      logger.error(`Error updating settings for guild ${guildId}:`, error);
      return null;
    }
  }

  clearCache(guildId: string) {
    this.cache.del(guildId);
  }
}
