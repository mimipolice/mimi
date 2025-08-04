import { sql } from "kysely";
import { gachaDB } from "../shared/database";

export interface OdogStats {
  user_id: string;
  nickname: string;
  total_draws: number;
  top_tier_draws: number;
  rarity_counts: { [rarity: string]: number };
}

export interface GachaPool {
  gacha_id: string;
  gacha_name: string;
  gacha_name_alias: string;
}

export async function getGachaPools(searchText: string): Promise<GachaPool[]> {
  return await gachaDB
    .selectFrom("gacha_pools")
    .distinct()
    .select(["gacha_id", "gacha_name", "gacha_name_alias"])
    .where((eb) =>
      eb.or([
        eb("gacha_name", "ilike", `%${searchText}%`),
        eb("gacha_name_alias", "ilike", `%${searchText}%`),
      ])
    )
    .orderBy("gacha_name")
    .limit(25)
    .execute();
}

export async function getOdogRankings(
  gacha_id: string | null,
  days: number | "all"
): Promise<OdogStats[]> {
  let query = gachaDB
    .with("PoolMaxRarity", (db) =>
      db
        .selectFrom("gacha_master_cards")
        .select(["pool_type", sql`MAX(rarity)`.as("max_rarity")])
        .groupBy("pool_type")
    )
    .with("AllTopTierDraws", (db) => {
      let subQuery = db
        .selectFrom("gacha_draw_history")
        .innerJoin(
          "gacha_master_cards",
          "gacha_draw_history.card_id",
          "gacha_master_cards.card_id"
        )
        .innerJoin(
          "PoolMaxRarity",
          "gacha_master_cards.pool_type",
          "PoolMaxRarity.pool_type"
        )
        .whereRef(
          "gacha_master_cards.rarity",
          ">=",
          sql`"PoolMaxRarity".max_rarity - 1`
        )
        .select(["gacha_draw_history.user_id", "gacha_master_cards.rarity"]);

      if (gacha_id) {
        subQuery = subQuery.where(
          "gacha_master_cards.pool_type",
          "=",
          gacha_id
        );
      }
      if (days !== "all") {
        subQuery = subQuery.where(
          "gacha_draw_history.created_at",
          ">=",
          sql`NOW() - INTERVAL '${sql.raw(`${days} days`)}'` as any
        );
      }
      return subQuery;
    })
    .with("UserRarityCounts", (db) =>
      db
        .selectFrom("AllTopTierDraws")
        .select(["user_id", "rarity", sql`COUNT(*)`.as("draw_count")])
        .groupBy(["user_id", "rarity"])
    )
    .with("AggregatedStats", (db) =>
      db
        .selectFrom("UserRarityCounts")
        .groupBy("user_id")
        .select([
          "user_id",
          sql`SUM(draw_count)`.as("total_draws"),
          sql`jsonb_object_agg(rarity, draw_count)`.as("rarity_counts"),
          sql`COALESCE(SUM(CASE WHEN rarity = 7 THEN draw_count END), 0)`.as(
            "r7"
          ),
          sql`COALESCE(SUM(CASE WHEN rarity = 6 THEN draw_count END), 0)`.as(
            "r6"
          ),
          sql`COALESCE(SUM(CASE WHEN rarity = 5 THEN draw_count END), 0)`.as(
            "r5"
          ),
          sql`COALESCE(SUM(CASE WHEN rarity = 4 THEN draw_count END), 0)`.as(
            "r4"
          ),
          sql`COALESCE(SUM(CASE WHEN rarity = 3 THEN draw_count END), 0)`.as(
            "r3"
          ),
          sql`COALESCE(SUM(CASE WHEN rarity = 2 THEN draw_count END), 0)`.as(
            "r2"
          ),
          sql`COALESCE(SUM(CASE WHEN rarity = 1 THEN draw_count END), 0)`.as(
            "r1"
          ),
        ])
    )
    .selectFrom("gacha_users")
    .innerJoin(
      "AggregatedStats",
      "gacha_users.user_id",
      "AggregatedStats.user_id"
    )
    .select([
      "gacha_users.user_id",
      "gacha_users.nickname",
      "AggregatedStats.total_draws",
      "AggregatedStats.total_draws as top_tier_draws",
      "AggregatedStats.rarity_counts",
    ])
    .orderBy("r7", "desc")
    .orderBy("r6", "desc")
    .orderBy("r5", "desc")
    .orderBy("r4", "desc")
    .orderBy("r3", "desc")
    .orderBy("r2", "desc")
    .orderBy("r1", "desc")
    .orderBy("total_draws", "desc");

  const result = await query.execute();
  return result.map((row: any) => ({
    ...row,
    rarity_counts: row.rarity_counts || {},
  }));
}
