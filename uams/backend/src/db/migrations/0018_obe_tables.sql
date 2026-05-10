-- blooms_level enum
DO $$ BEGIN
  CREATE TYPE "public"."blooms_level" AS ENUM('remember','understand','apply','analyze','evaluate','create');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

-- course_learning_outcomes
CREATE TABLE IF NOT EXISTS "course_learning_outcomes" (
  "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id"    uuid NOT NULL,
  "course_id"    uuid NOT NULL,
  "code"         varchar(20) NOT NULL,
  "description"  text NOT NULL,
  "blooms_level" "blooms_level",
  "created_by"   uuid,
  "updated_by"   uuid,
  "deleted_by"   uuid,
  "created_at"   timestamp NOT NULL DEFAULT now(),
  "updated_at"   timestamp NOT NULL DEFAULT now(),
  "deleted_at"   timestamp,
  CONSTRAINT "uq_clo_tenant_course_code" UNIQUE ("tenant_id","course_id","code")
);--> statement-breakpoint
ALTER TABLE "course_learning_outcomes" ADD CONSTRAINT "clo_tenant_fk"    FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "course_learning_outcomes" ADD CONSTRAINT "clo_course_fk"    FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE restrict;--> statement-breakpoint
ALTER TABLE "course_learning_outcomes" ADD CONSTRAINT "clo_created_by_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null;--> statement-breakpoint
ALTER TABLE "course_learning_outcomes" ADD CONSTRAINT "clo_updated_by_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null;--> statement-breakpoint
ALTER TABLE "course_learning_outcomes" ADD CONSTRAINT "clo_deleted_by_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null;--> statement-breakpoint

-- clo_audit_logs
CREATE TABLE IF NOT EXISTS "clo_audit_logs" (
  "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id"    uuid NOT NULL,
  "clo_id"       uuid NOT NULL,
  "action"       "audit_action" NOT NULL,
  "performed_by" uuid,
  "snapshot"     jsonb,
  "created_at"   timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint
ALTER TABLE "clo_audit_logs" ADD CONSTRAINT "clo_audit_tenant_fk"   FOREIGN KEY ("tenant_id")    REFERENCES "public"."tenants"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "clo_audit_logs" ADD CONSTRAINT "clo_audit_performer_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id")   ON DELETE set null;--> statement-breakpoint

-- program_learning_outcomes
CREATE TABLE IF NOT EXISTS "program_learning_outcomes" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id"   uuid NOT NULL,
  "program_id"  uuid NOT NULL,
  "code"        varchar(20) NOT NULL,
  "description" text NOT NULL,
  "created_by"  uuid,
  "updated_by"  uuid,
  "deleted_by"  uuid,
  "created_at"  timestamp NOT NULL DEFAULT now(),
  "updated_at"  timestamp NOT NULL DEFAULT now(),
  "deleted_at"  timestamp,
  CONSTRAINT "uq_plo_tenant_program_code" UNIQUE ("tenant_id","program_id","code")
);--> statement-breakpoint
ALTER TABLE "program_learning_outcomes" ADD CONSTRAINT "plo_tenant_fk"    FOREIGN KEY ("tenant_id")  REFERENCES "public"."tenants"("id")  ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "program_learning_outcomes" ADD CONSTRAINT "plo_program_fk"   FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE restrict;--> statement-breakpoint
ALTER TABLE "program_learning_outcomes" ADD CONSTRAINT "plo_created_by_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null;--> statement-breakpoint
ALTER TABLE "program_learning_outcomes" ADD CONSTRAINT "plo_updated_by_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null;--> statement-breakpoint
ALTER TABLE "program_learning_outcomes" ADD CONSTRAINT "plo_deleted_by_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null;--> statement-breakpoint

-- plo_audit_logs
CREATE TABLE IF NOT EXISTS "plo_audit_logs" (
  "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id"    uuid NOT NULL,
  "plo_id"       uuid NOT NULL,
  "action"       "audit_action" NOT NULL,
  "performed_by" uuid,
  "snapshot"     jsonb,
  "created_at"   timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint
ALTER TABLE "plo_audit_logs" ADD CONSTRAINT "plo_audit_tenant_fk"    FOREIGN KEY ("tenant_id")    REFERENCES "public"."tenants"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "plo_audit_logs" ADD CONSTRAINT "plo_audit_performer_fk"  FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id")   ON DELETE set null;--> statement-breakpoint

-- clo_plo_mappings
CREATE TABLE IF NOT EXISTS "clo_plo_mappings" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id"  uuid NOT NULL,
  "clo_id"     uuid NOT NULL,
  "plo_id"     uuid NOT NULL,
  "weight"     numeric(3,2) NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "uq_clo_plo_mapping" UNIQUE ("clo_id","plo_id"),
  CONSTRAINT "chk_weight_range" CHECK ("weight" >= 0 AND "weight" <= 1)
);--> statement-breakpoint
ALTER TABLE "clo_plo_mappings" ADD CONSTRAINT "mapping_tenant_fk"     FOREIGN KEY ("tenant_id")  REFERENCES "public"."tenants"("id")                    ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "clo_plo_mappings" ADD CONSTRAINT "mapping_clo_fk"        FOREIGN KEY ("clo_id")     REFERENCES "public"."course_learning_outcomes"("id")    ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "clo_plo_mappings" ADD CONSTRAINT "mapping_plo_fk"        FOREIGN KEY ("plo_id")     REFERENCES "public"."program_learning_outcomes"("id")   ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "clo_plo_mappings" ADD CONSTRAINT "mapping_created_by_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null;--> statement-breakpoint
ALTER TABLE "clo_plo_mappings" ADD CONSTRAINT "mapping_updated_by_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null;--> statement-breakpoint

-- clo_plo_mapping_audit_logs
CREATE TABLE IF NOT EXISTS "clo_plo_mapping_audit_logs" (
  "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id"    uuid NOT NULL,
  "mapping_id"   uuid NOT NULL,
  "action"       "audit_action" NOT NULL,
  "performed_by" uuid,
  "snapshot"     jsonb,
  "created_at"   timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint
ALTER TABLE "clo_plo_mapping_audit_logs" ADD CONSTRAINT "mapping_audit_tenant_fk"    FOREIGN KEY ("tenant_id")    REFERENCES "public"."tenants"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "clo_plo_mapping_audit_logs" ADD CONSTRAINT "mapping_audit_performer_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id")   ON DELETE set null;
