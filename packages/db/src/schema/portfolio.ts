import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";

import { user } from "./auth";

export const pageViews = pgTable("page_views", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  count: integer("count").default(0).notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const guestbookEntries = pgTable("guestbook_entries", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * One signature per user, enforced at the DB layer via `.unique()` on
 * `userId`. A second insert for the same user throws a unique-constraint
 * violation which the router catches and turns into a friendly error.
 */
export const guestbookSignatures = pgTable("guestbook_signatures", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  svgPath: text("svg_path").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
