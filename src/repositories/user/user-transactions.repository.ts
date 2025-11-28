import { gachaDB } from "../../shared/database";
import logger from "../../utils/logger";
import { UserTransaction } from "../../shared/database/types";

export async function getRecentTransactions(
  userId: string,
  offset: number,
  limit: number
): Promise<UserTransaction[]> {
  try {
    const result = await gachaDB
      .selectFrom("user_transaction_history")
      .select(["sender_id", "receiver_id", "net_amount", "created_at"])
      .where((eb) =>
        eb.or([eb("sender_id", "=", userId), eb("receiver_id", "=", userId)])
      )
      .orderBy("created_at", "desc")
      .offset(offset)
      .limit(limit)
      .execute();

    return result.map((row) => ({
      ...row,
      amount: row.net_amount,
    }));
  } catch (error) {
    logger.error(`[getRecentTransactions] Error fetching transactions for user ${userId}:`, {
      error: error instanceof Error ? error.message : String(error),
      userId,
      offset,
      limit,
    });
    return [];
  }
}
