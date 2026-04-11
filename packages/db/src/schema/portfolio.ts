import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";

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
