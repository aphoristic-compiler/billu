CREATE TABLE "daily_banners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" varchar(10) NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "daily_banners_date_unique" UNIQUE("date")
);
--> statement-breakpoint
ALTER TABLE "events" DROP COLUMN "notes";