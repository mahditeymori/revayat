CREATE TYPE "public"."support_message_status" AS ENUM('open', 'answered', 'closed');--> statement-breakpoint
CREATE TABLE "support_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference_code" text NOT NULL,
	"name" text NOT NULL,
	"contact" text NOT NULL,
	"message" text NOT NULL,
	"status" "support_message_status" DEFAULT 'open' NOT NULL,
	"admin_reply" text,
	"replied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "support_messages_reference_code_unique" UNIQUE("reference_code")
);
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "material" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "fabric_type" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "weight" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "additional_notes" text;--> statement-breakpoint
CREATE INDEX "support_messages_status_idx" ON "support_messages" USING btree ("status");