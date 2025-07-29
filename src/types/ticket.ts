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
}
