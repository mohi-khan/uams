CREATE TYPE "public"."tier" AS ENUM('0-50', '51-100', '101-500', '501-1000', '1001+');--> statement-breakpoint
ALTER TABLE "tenants" ALTER COLUMN "is_active" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "email" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "phone" varchar(50);--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "address" varchar(500);--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "city" varchar(100);--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "country" varchar(100);--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "tier" "tier" NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "is_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_email_unique" UNIQUE("email");