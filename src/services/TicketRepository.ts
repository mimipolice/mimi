import { Kysely, Selectable } from "kysely";
import { DB, Ticket as TicketTable } from "../shared/database/types";
import { TicketStatus } from "../types/ticket";

export type Ticket = Selectable<TicketTable>;

export class TicketRepository {
  private db: Kysely<DB>;

  constructor(db: Kysely<DB>) {
    this.db = db;
  }

  async findOpenTicketByOwner(
    guildId: string,
    ownerId: string
  ): Promise<Ticket | undefined> {
    return await this.db
      .selectFrom("tickets")
      .selectAll()
      .where("guildId", "=", guildId)
      .where("ownerId", "=", ownerId)
      .where("status", "=", TicketStatus.OPEN)
      .executeTakeFirst();
  }

  async findTicketByChannel(channelId: string): Promise<Ticket | undefined> {
    return await this.db
      .selectFrom("tickets")
      .selectAll()
      .where("channelId", "=", channelId)
      .executeTakeFirst();
  }

  async createTicket(data: {
    guildId: string;
    channelId: string;
    ownerId: string;
  }): Promise<void> {
    await this.db
      .insertInto("tickets")
      .values({
        ...data,
        status: TicketStatus.OPEN,
        createdAt: new Date().toISOString(),
      })
      .execute();
  }

  async closeTicket(
    channelId: string,
    data: {
      closeReason?: string;
      closedById: string;
      transcriptUrl?: string;
      logMessageId?: string;
    }
  ): Promise<void> {
    await this.db
      .updateTable("tickets")
      .set({
        status: TicketStatus.CLOSED,
        closedAt: new Date().toISOString(),
        ...data,
      })
      .where("channelId", "=", channelId)
      .execute();
  }
}
