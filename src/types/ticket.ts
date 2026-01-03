export enum TicketStatus {
  OPEN = "OPEN",
  CLOSED = "CLOSED",
}

export const TicketAction = {
  CLOSE: "close_ticket",
  CLAIM: "claim_ticket",
};

export interface Ticket {
  id: number;
  guildTicketId: number;
  guildId: string;
  channelId: string;
  ownerId: string;
  claimedById: string | null;
  status: TicketStatus;
  closeReason: string | null;
  closedById: string | null;
  createdAt: string;
  closedAt: string | null;
  feedbackRating: number | null;
  feedbackComment: string | null;
  // Ticket management fields (set via log message select menu)
  category: TicketCategory | null;
  rating: number | null;
  resolution: TicketResolution | null;
}

// Ticket categories for classification
export enum TicketCategory {
  TECHNICAL = "technical",
  BILLING = "billing",
  GENERAL = "general",
  REPORT = "report",
  FEEDBACK = "feedback",
  ABUSE = "abuse",
}

// Ticket resolution status
export enum TicketResolution {
  RESOLVED = "resolved",
  UNRESOLVED = "unresolved",
  FOLLOW_UP = "follow_up",
  ABUSE = "abuse",
}

// Select menu action types
export const TicketLogMenuAction = {
  // Main menu
  MAIN: "ticket_log_menu:main",
  // Sub menus
  HISTORY: "ticket_log_menu:history",
  STATUS: "ticket_log_menu:status",
  CATEGORY: "ticket_log_menu:category",
  RATING: "ticket_log_menu:rating",
} as const;

// Shared menu option values for consistency between DiscordService and ticketLogMenu
export const TicketLogMenuOptions = {
  HISTORY: { value: "history", emoji: "📋" },
  STATUS: { value: "status", emoji: "🏷️" },
  CATEGORY: { value: "category", emoji: "📁" },
  RATING: { value: "rating", emoji: "⭐" },
} as const;
