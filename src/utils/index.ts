/**
 * Utils Index
 * Centralized exports for all utilities
 */

// Core
export { default as logger } from "./logger";
export { errorHandler } from "./errorHandler";
export { sanitize } from "./sanitize";
export { getLocalizations } from "./localization";

// Discord Interaction
export {
  createUnauthorizedReply,
  createBusinessErrorReply,
  createCheckFailureReply,
  createCooldownReply,
  createInternalErrorReply,
  createAutoModBlockedReply,
  createDiscordErrorReply,
  createMissingPermissionsReply,
} from "./interactionReply";
export { createReply } from "./replyHelper";
export { isValidEmoji, getEmojiIdentifier } from "./emojiValidator";

// Transcript
export { generateTranscript } from "./transcript/transcript";
export { generateTranscriptWithOG, type OGMetadata } from "./transcript/transcriptWithOG";
export { generateChatTranscript } from "./transcript/chatTranscript";

// Rendering
export { generateCandlestickChart } from "./chart-generator";
export { markdownTableToImage } from "./markdown-to-image";

// UI Base Classes
export { BaseModal } from "./baseModal";
export { BaseView } from "./baseView";

// Ticket Debug
export {
  logChannelPermissions,
  safeDeletePermissionOverwrite,
  safeEditPermissionOverwrite,
} from "./ticketDebug";

// Transport
export { DiscordWebhookTransport } from "./discordWebhookTransport";
