CREATE TYPE "public"."meeting_type" AS ENUM('regular', 'competition', 'outreach');--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "type" "meeting_type" DEFAULT 'regular' NOT NULL;