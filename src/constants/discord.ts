/**
 * Centralized Discord constants for the Mimi bot
 *
 * This file contains all Discord-related constants including:
 * - Brand colors
 * - Default avatar URLs
 * - Custom emoji definitions
 * - Asset URLs
 */

// ============================================
// Discord Brand Colors
// ============================================

/** Discord Blurple - Primary brand color */
export const DISCORD_BLURPLE = 0x5865f2;

/** Discord Green - Success/positive color */
export const DISCORD_GREEN = 0x57f287;

/** Discord Red - Error/danger color */
export const DISCORD_RED = 0xed4245;

/** Discord Yellow - Warning color */
export const DISCORD_YELLOW = 0xfee75c;

// ============================================
// Default Assets
// ============================================

/** Discord default avatar URL (used when user/guild has no avatar) */
export const DISCORD_DEFAULT_AVATAR = "https://cdn.discordapp.com/embed/avatars/0.png";

/** Ticket log banner image URL */
export const TICKET_LOG_BANNER_URL = "https://transcript.mimidlc.me/assets/ticket_log_banner.png";

// ============================================
// Custom Emojis
// ============================================

/**
 * Custom emoji definitions for the bot
 *
 * Each emoji has:
 * - id: The Discord snowflake ID
 * - toString(): Returns the full emoji format for use in text content
 * - toComponentEmoji(): Returns the object format for use in components (buttons, select menus)
 *
 * Usage in text:     `${EMOJIS.ID} Ticket #123`
 * Usage in button:   .setEmoji(EMOJIS.ID.toComponentEmoji())
 */

interface CustomEmoji {
  /** Emoji name */
  name: string;
  /** Discord snowflake ID */
  id: string;
  /** Returns full emoji format for text content: <:name:id> */
  toString(): string;
  /** Returns object format for component emoji: { id: "..." } */
  toComponentEmoji(): { id: string; name: string };
}

function createEmoji(name: string, id: string): CustomEmoji {
  return {
    name,
    id,
    toString() {
      return `<:${name}:${id}>`;
    },
    toComponentEmoji() {
      return { id, name };
    },
  };
}

/** Ticket system emojis */
export const EMOJIS = {
  /** Ticket ID / History */
  ID: createEmoji("id", "1395852626360275166"),
  /** Opened by / Owner */
  OPEN: createEmoji("open", "1395852835266236547"),
  /** Open time / Created at */
  OPENTIME: createEmoji("opentime", "1395852963079000106"),
  /** Close / Closed */
  CLOSE: createEmoji("close", "1395852886596128818"),
  /** Claim / Claimed by */
  CLAIM: createEmoji("claim", "1395853067357786202"),
  /** Reason */
  REASON: createEmoji("reason", "1395853176841834516"),
  /** Notice / Warning */
  NOTICE: createEmoji("notice", "1444897740566958111"),
  /** Discord */
  DC: createEmoji("dc", "1442109164624154664"),
  // Additional emojis (purpose to be confirmed)
  BC: createEmoji("bc", "1444896412042002533"),
  BCK: createEmoji("bck", "1444901131825315850"),
  BH: createEmoji("bh", "1444897086763044976"),
  BOW: createEmoji("bow", "1444897109336653886"),
  SC: createEmoji("sc", "1444897142509670481"),
  ST: createEmoji("st", "1444900782372683786"),
  PCK: createEmoji("pck", "1444901376139202662"),
} as const;

// ============================================
// Type exports
// ============================================

export type EmojiKey = keyof typeof EMOJIS;
