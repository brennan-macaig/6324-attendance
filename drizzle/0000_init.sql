CREATE TYPE "public"."role" AS ENUM('student', 'mentor', 'admin');--> statement-breakpoint
CREATE TABLE "checkins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"meeting_id" uuid NOT NULL,
	"checked_in_at" timestamp with time zone DEFAULT now() NOT NULL,
	"checked_out_at" timestamp with time zone,
	"ip" text,
	"device_id" text,
	"flags" text[] DEFAULT '{}'::text[] NOT NULL,
	"manual_adjusted_by" uuid,
	"manual_adjusted_at" timestamp with time zone,
	CONSTRAINT "checkins_student_meeting_uq" UNIQUE("student_id","meeting_id")
);
--> statement-breakpoint
CREATE TABLE "meetings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"starts_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ends_at" timestamp with time zone,
	"is_open" boolean DEFAULT true NOT NULL,
	"opened_by" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seasons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"is_current" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"image" text,
	"role" "role" DEFAULT 'student' NOT NULL,
	"subteam" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_manual_adjusted_by_users_id_fk" FOREIGN KEY ("manual_adjusted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_opened_by_users_id_fk" FOREIGN KEY ("opened_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "checkins_meeting_idx" ON "checkins" USING btree ("meeting_id");--> statement-breakpoint
CREATE INDEX "checkins_checked_in_at_idx" ON "checkins" USING btree ("checked_in_at");--> statement-breakpoint
CREATE INDEX "checkins_meeting_device_idx" ON "checkins" USING btree ("meeting_id","device_id");--> statement-breakpoint
CREATE INDEX "meetings_season_starts_idx" ON "meetings" USING btree ("season_id","starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "meetings_one_open_idx" ON "meetings" USING btree ("is_open") WHERE "meetings"."is_open" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "seasons_one_current_idx" ON "seasons" USING btree ("is_current") WHERE "seasons"."is_current" = true;--> statement-breakpoint
CREATE INDEX "users_role_active_idx" ON "users" USING btree ("role","active");