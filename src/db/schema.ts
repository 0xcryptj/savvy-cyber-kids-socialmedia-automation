import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamps = { createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull() };

export const articles = sqliteTable("articles", {
  id: text("id").primaryKey(), sourceType: text("source_type").notNull(), sourceUrl: text("source_url").notNull(),
  canonicalUrl: text("canonical_url").notNull(), title: text("title").notNull(), body: text("body").notNull(),
  featuredImageUrl: text("featured_image_url"), publishedAt: integer("published_at", { mode: "timestamp_ms" }), ingestedAt: integer("ingested_at", { mode: "timestamp_ms" }).notNull()
}, (table) => ({ canonicalUrlIdx: uniqueIndex("articles_canonical_url_idx").on(table.canonicalUrl) }));

export const posts = sqliteTable("posts", {
  id: text("id").primaryKey(), articleId: text("article_id").notNull().references(() => articles.id), topicHeading: text("topic_heading").notNull(),
  caption: text("caption").notNull(), status: text("status").notNull(), graphicPath: text("graphic_path"), canvaDesignId: text("canva_design_id"), socialBeeId: text("socialbee_id"),
  createdAt: timestamps.createdAt, approvedAt: integer("approved_at", { mode: "timestamp_ms" }), queuedAt: integer("queued_at", { mode: "timestamp_ms" }), scheduledAt: integer("scheduled_at", { mode: "timestamp_ms" }), publishedAt: integer("published_at", { mode: "timestamp_ms" })
});

export const postHashtags = sqliteTable("post_hashtags", { id: text("id").primaryKey(), postId: text("post_id").notNull().references(() => posts.id), hashtag: text("hashtag").notNull() });
export const revisions = sqliteTable("revisions", { id: text("id").primaryKey(), postId: text("post_id").notNull().references(() => posts.id), field: text("field").notNull(), oldValue: text("old_value").notNull(), newValue: text("new_value").notNull(), ...timestamps });
export const auditLogs = sqliteTable("audit_logs", { id: text("id").primaryKey(), postId: text("post_id").references(() => posts.id), type: text("type").notNull(), message: text("message").notNull(), metadata: text("metadata", { mode: "json" }), ...timestamps });
