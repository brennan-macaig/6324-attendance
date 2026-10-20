CREATE TYPE "public"."theme" AS ENUM('navy', 'teal', 'green', 'purple', 'red', 'orange');--> statement-breakpoint
CREATE TABLE "settings" (
	"id" text PRIMARY KEY DEFAULT 'global' NOT NULL,
	"theme" "theme" DEFAULT 'navy' NOT NULL
);--> statement-breakpoint
INSERT INTO "settings" ("id") VALUES ('global') ON CONFLICT DO NOTHING;
