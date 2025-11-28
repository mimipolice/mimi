import { sql } from "kysely";
import { CacheService } from "../../services/CacheService";
import { gachaDB } from "../../shared/database";

const cacheService = new CacheService();

export async function updateUserBalance(
  userId: string,
  amount: number,
  type: "oil_balance" | "oil_ticket_balance"
): Promise<void> {
  await gachaDB
    .updateTable("gacha_users")
    .set({ [type]: sql`${sql.ref(type)} + ${amount}` })
    .where("user_id", "=", userId)
    .execute();

  await cacheService.del(`user-info:${userId}`);
}

export async function updateUserBalancesForTrade(
  senderId: string,
  receiverId: string,
  amount: number
): Promise<void> {
  await gachaDB.transaction().execute(async (trx) => {
    await trx
      .updateTable("gacha_users")
      .set({ oil_balance: sql`oil_balance - ${amount}` })
      .where("user_id", "=", senderId)
      .execute();

    await trx
      .updateTable("gacha_users")
      .set({ oil_balance: sql`oil_balance + ${amount}` })
      .where("user_id", "=", receiverId)
      .execute();
  });

  await Promise.all([
    cacheService.del(`user-info:${senderId}`),
    cacheService.del(`user-info:${receiverId}`),
  ]);
}
