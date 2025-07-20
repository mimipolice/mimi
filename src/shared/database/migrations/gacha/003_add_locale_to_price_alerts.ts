import { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("price_alerts")
    .addColumn("locale", "varchar(10)", (col) =>
      col.notNull().defaultTo("en-US")
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable("price_alerts").dropColumn("locale").execute();
}
