import { Kysely, Selectable, sql } from "kysely";
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
    guildTicketId: number; // 新增這個參數
  }): Promise<void> {
    // 返回類型應為 Promise<void> 或其他適當類型
    await this.db
      .insertInto("tickets")
      .values({
        ...data,
        status: TicketStatus.OPEN,
        createdAt: new Date().toISOString(),
      })
      .execute();
  }

  async getNextGuildTicketId(guildId: string): Promise<number> {
    // This is an atomic operation that inserts a new counter if it doesn't exist,
    // increments the counter, and returns the new value.
    const result = await this.db
      .insertInto("guild_ticket_counters")
      .values({ guildId: guildId, lastTicketId: 1 })
      .onConflict((oc) =>
        oc.column("guildId").doUpdateSet({
          lastTicketId: sql`guild_ticket_counters."lastTicketId" + 1`,
        })
      )
      .returning("lastTicketId")
      .executeTakeFirstOrThrow();

    return result.lastTicketId;
  }

  async resetCounter(guildId: string): Promise<void> {
    await this.db
      .updateTable("guild_ticket_counters")
      .set({ lastTicketId: 0 })
      .where("guildId", "=", guildId)
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
