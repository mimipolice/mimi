import { Kysely, sql } from "kysely";
import { MimiDLCDB } from "../shared/database/types";

export interface ForumPostSolution {
  thread_id: string;
  message_id: string;
  author_id: string;
  tags: string[] | null;
}

export async function setSolution(
  db: Kysely<MimiDLCDB>,
  threadId: string,
  messageId: string,
  authorId: string,
  tags: string[] | null
): Promise<void> {
  await db
    .insertInto("forum_post_solutions")
    .values({
      thread_id: threadId,
      message_id: messageId,
      author_id: authorId,
      tags: tags,
    })
    .onConflict((oc) =>
      oc.column("thread_id").doUpdateSet({
        message_id: messageId,
        author_id: authorId,
        tags: tags,
      })
    )
    .execute();
}

export async function getSolution(
  db: Kysely<MimiDLCDB>,
  threadId: string
): Promise<ForumPostSolution | null> {
  const result = await db
    .selectFrom("forum_post_solutions")
    .selectAll()
    .where("thread_id", "=", threadId)
    .executeTakeFirst();

  return result ?? null;
}

export async function getSolutionsByTag(
  db: Kysely<MimiDLCDB>,
  tag: string
): Promise<ForumPostSolution[]> {
  const result = await db
    .selectFrom("forum_post_solutions")
    .selectAll()
    .where(sql<boolean>`${tag} = ANY(tags)`)
    .execute();

  return result;
}

export async function removeSolution(
  db: Kysely<MimiDLCDB>,
  threadId: string
): Promise<void> {
  await db
    .deleteFrom("forum_post_solutions")
    .where("thread_id", "=", threadId)
    .execute();
}
