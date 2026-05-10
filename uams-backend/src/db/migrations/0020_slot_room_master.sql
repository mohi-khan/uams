CREATE TYPE "public"."room_type" AS ENUM('THEORY', 'LAB');
--> statement-breakpoint
CREATE TABLE "time_slots" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id"        uuid NOT NULL,
  "name"             varchar(50) NOT NULL,
  "start_time"       varchar(5) NOT NULL,
  "end_time"         varchar(5) NOT NULL,
  "duration_minutes" integer NOT NULL,
  "is_active"        boolean NOT NULL DEFAULT true,
  "created_at"       timestamp NOT NULL DEFAULT now(),
  "updated_at"       timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rooms" (
  "id"        uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "name"      varchar(100) NOT NULL,
  "capacity"  integer NOT NULL,
  "type"      "room_type" NOT NULL DEFAULT 'THEORY',
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "time_slots" ADD CONSTRAINT "time_slots_tenant_id_fk"
  FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_tenant_id_fk"
  FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "time_slots" ADD CONSTRAINT "uq_time_slots_tenant_name" UNIQUE("tenant_id","name");
--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "uq_rooms_tenant_name" UNIQUE("tenant_id","name");
