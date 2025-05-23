CREATE TABLE "gif_searches" (
	"id" serial PRIMARY KEY NOT NULL,
	"query" text NOT NULL,
	"gif_url" text NOT NULL,
	"thumbnail_url" text NOT NULL,
	"provider" text NOT NULL,
	"search_count" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"user_id" integer
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"default_provider" text DEFAULT 'auto' NOT NULL,
	"auto_check_updates" boolean DEFAULT true NOT NULL,
	"gif_duration" integer DEFAULT 5 NOT NULL,
	"gif_quality" text DEFAULT 'high' NOT NULL,
	"save_history" boolean DEFAULT true NOT NULL,
	"api_keys" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_settings_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "gif_searches" ADD CONSTRAINT "gif_searches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;