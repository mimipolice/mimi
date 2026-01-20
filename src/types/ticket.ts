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
  // Ticket open reason (issue description from creation)
  openReason: string | null;
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
  // History menu (triggered by button, handled by select menu)
  HISTORY: "ticket_log_menu:history",
} as const;
