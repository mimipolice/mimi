import { Kysely } from "kysely";
import { mimiDLCDb } from "../shared/database";
import { MimiDLCDB } from "../shared/database/types";

// Auto-React Queries
export interface AutoReact {
  guild_id: string;
  channel_id: string;
  emoji: string;
}

export async function setAutoreact(
  db: Kysely<MimiDLCDB>,
  guildId: string,
  channelId: string,
  emoji: string
): Promise<void> {
  await db
    .insertInto("auto_reacts")
    .values({ guild_id: guildId, channel_id: channelId, emoji: emoji })
    .onConflict((oc) =>
      oc.columns(["guild_id", "channel_id"]).doUpdateSet({ emoji: emoji })
    )
    .execute();
}

export async function removeAutoreact(
  db: Kysely<MimiDLCDB>,
  guildId: string,
  channelId: string
): Promise<void> {
  await db
    .deleteFrom("auto_reacts")
    .where("guild_id", "=", guildId)
    .where("channel_id", "=", channelId)
    .execute();
}

export async function getAutoreacts(
  db: Kysely<MimiDLCDB>,
  guildId: string
): Promise<
  {
    channel_id: string;
    emoji: string;
  }[]
> {
  return await db
    .selectFrom("auto_reacts")
    .select(["channel_id", "emoji"])
    .where("guild_id", "=", guildId)
    .execute();
}

export async function getAllAutoreacts(): Promise<AutoReact[]> {
  return await mimiDLCDb
    .selectFrom("auto_reacts")
    .select(["guild_id", "channel_id", "emoji"])
    .execute();
}

// Keyword Queries
export interface Keyword {
  id: number;
  guild_id: string;
  keyword: string;
  reply: string;
  match_type: "exact" | "contains";
}

export async function addKeyword(
  db: Kysely<MimiDLCDB>,
  guildId: string,
  keyword: string,
  reply: string,
  matchType: "exact" | "contains"
): Promise<void> {
  await db
    .insertInto("keywords")
    .values({
      guild_id: guildId,
      keyword: keyword,
      reply: reply,
      match_type: matchType,
    })
    .onConflict((oc) =>
      oc
        .columns(["guild_id", "keyword"])
        .doUpdateSet({ reply: reply, match_type: matchType })
    )
    .execute();
}

export async function removeKeyword(
  db: Kysely<MimiDLCDB>,
  guildId: string,
  keyword: string
): Promise<void> {
  await db
    .deleteFrom("keywords")
    .where("guild_id", "=", guildId)
    .where("keyword", "=", keyword)
    .execute();
}

export async function getKeywordsByGuild(
  db: Kysely<MimiDLCDB>,
  guildId: string
): Promise<Keyword[]> {
  if (guildId === "*") {
    return await db.selectFrom("keywords").selectAll().execute();
  }
  return await db
    .selectFrom("keywords")
    .selectAll()
    .where("guild_id", "=", guildId)
    .execute();
}

// To-Do List Queries
export interface Todo {
  id: number;
  user_id: string;
  item: string;
  created_at: Date;
}

export async function addTodo(
  db: Kysely<MimiDLCDB>,
  userId: string,
  item: string
): Promise<void> {
  await db
    .insertInto("todos")
    .values({ user_id: userId, item: item })
    .execute();
}

export async function removeTodo(
  db: Kysely<MimiDLCDB>,
  id: number,
  userId: string
): Promise<bigint> {
  const result = await db
    .deleteFrom("todos")
    .where("id", "=", id)
    .where("user_id", "=", userId)
    .executeTakeFirst();
  return result.numDeletedRows;
}

export async function getTodos(
  db: Kysely<MimiDLCDB>,
  userId: string
): Promise<
  {
    id: number;
    item: string;
    created_at: Date;
  }[]
> {
  return await db
    .selectFrom("todos")
    .select(["id", "item", "created_at"])
    .where("user_id", "=", userId)
    .orderBy("created_at", "asc")
    .execute();
}

export async function clearTodos(
  db: Kysely<MimiDLCDB>,
  userId: string
): Promise<void> {
  await db.deleteFrom("todos").where("user_id", "=", userId).execute();
}

// Anti-Spam Log Channel Queries
export async function getAntiSpamLogChannel(
  guildId: string
): Promise<string | null> {
  const result = await mimiDLCDb
    .selectFrom("anti_spam_logs")
    .select("log_channel_id")
    .where("guild_id", "=", guildId)
    .executeTakeFirst();
  return result?.log_channel_id ?? null;
}

export async function setAntiSpamLogChannel(
  guildId: string,
  channelId: string
): Promise<void> {
  await mimiDLCDb
    .insertInto("anti_spam_logs")
    .values({
      guild_id: guildId,
      log_channel_id: channelId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .onConflict((oc) =>
      oc.column("guild_id").doUpdateSet({
        log_channel_id: channelId,
        updated_at: new Date().toISOString(),
      })
    )
    .execute();
}

// Anti-Spam Settings Queries
export type AntiSpamSettings = MimiDLCDB["anti_spam_settings"];

export async function getAntiSpamSettings(
  guildId: string
): Promise<AntiSpamSettings | null> {
  const result = await mimiDLCDb
    .selectFrom("anti_spam_settings")
    .selectAll()
    .where("guildid", "=", guildId)
    .executeTakeFirst();
  return result ?? null;
}

export async function upsertAntiSpamSettings(
  settings: Partial<AntiSpamSettings> & { guildid: string }
): Promise<void> {
  const { guildid, ...updateData } = settings;
  await mimiDLCDb
    .insertInto("anti_spam_settings")
    .values({
      guildid: guildid,
      messagethreshold: updateData.messagethreshold ?? 5,
      time_window: updateData.time_window ?? 5000,
      timeoutduration: updateData.timeoutduration ?? 86400000,
      multichannelthreshold: updateData.multichannelthreshold,
      multichanneltimewindow: updateData.multichanneltimewindow,
    })
    .onConflict((oc) => oc.column("guildid").doUpdateSet(updateData))
    .execute();
}

export async function deleteAntiSpamSettings(guildId: string): Promise<void> {
  await mimiDLCDb
    .deleteFrom("anti_spam_settings")
    .where("guildid", "=", guildId)
    .execute();
}
