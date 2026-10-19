ALTER TABLE "seasons" ADD COLUMN "hours_target" numeric(6, 1) DEFAULT 80;--> statement-breakpoint
ALTER TABLE "seasons" ADD COLUMN "target_visible_from" date;