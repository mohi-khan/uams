-- assessment_plan_status enum
DO $$ BEGIN
  CREATE TYPE "public"."assessment_plan_status" AS ENUM('draft','final');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

-- assessment_component_type enum
DO $$ BEGIN
  CREATE TYPE "public"."assessment_component_type" AS ENUM('quiz','assignment','midterm','final','lab','project','presentation','other');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

-- course_assessment_plans
CREATE TABLE IF NOT EXISTS "course_assessment_plans" (
  "id"                   uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id"            uuid NOT NULL,
  "course_id"            uuid NOT NULL,
  "academic_session_id"  uuid NOT NULL,
  "version"              varchar(10) NOT NULL,
  "status"               "assessment_plan_status" NOT NULL DEFAULT 'draft',
  "is_default"           boolean NOT NULL DEFAULT false,
  "created_by"           uuid,
  "updated_by"           uuid,
  "deleted_by"           uuid,
  "created_at"           timestamp NOT NULL DEFAULT now(),
  "updated_at"           timestamp NOT NULL DEFAULT now(),
  "deleted_at"           timestamp,
  CONSTRAINT "uq_assessment_plan_version" UNIQUE ("tenant_id","course_id","academic_session_id","version")
);--> statement-breakpoint
ALTER TABLE "course_assessment_plans" ADD CONSTRAINT "cap_tenant_fk"   FOREIGN KEY ("tenant_id")           REFERENCES "public"."tenants"("id")            ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "course_assessment_plans" ADD CONSTRAINT "cap_course_fk"   FOREIGN KEY ("course_id")           REFERENCES "public"."courses"("id")            ON DELETE restrict;--> statement-breakpoint
ALTER TABLE "course_assessment_plans" ADD CONSTRAINT "cap_session_fk"  FOREIGN KEY ("academic_session_id") REFERENCES "public"."academic_sessions"("id")  ON DELETE restrict;--> statement-breakpoint
ALTER TABLE "course_assessment_plans" ADD CONSTRAINT "cap_created_fk"  FOREIGN KEY ("created_by")          REFERENCES "public"."users"("id")              ON DELETE set null;--> statement-breakpoint
ALTER TABLE "course_assessment_plans" ADD CONSTRAINT "cap_updated_fk"  FOREIGN KEY ("updated_by")          REFERENCES "public"."users"("id")              ON DELETE set null;--> statement-breakpoint
ALTER TABLE "course_assessment_plans" ADD CONSTRAINT "cap_deleted_fk"  FOREIGN KEY ("deleted_by")          REFERENCES "public"."users"("id")              ON DELETE set null;--> statement-breakpoint

-- assessment_plan_audit_logs
CREATE TABLE IF NOT EXISTS "assessment_plan_audit_logs" (
  "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id"    uuid NOT NULL,
  "plan_id"      uuid NOT NULL,
  "action"       "audit_action" NOT NULL,
  "performed_by" uuid,
  "snapshot"     jsonb,
  "created_at"   timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint
ALTER TABLE "assessment_plan_audit_logs" ADD CONSTRAINT "apal_tenant_fk"    FOREIGN KEY ("tenant_id")    REFERENCES "public"."tenants"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "assessment_plan_audit_logs" ADD CONSTRAINT "apal_performer_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id")   ON DELETE set null;--> statement-breakpoint

-- course_assessment_components
CREATE TABLE IF NOT EXISTS "course_assessment_components" (
  "id"                uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id"         uuid NOT NULL,
  "plan_id"           uuid NOT NULL,
  "name"              varchar(100) NOT NULL,
  "component_type"    "assessment_component_type" NOT NULL,
  "weight_percentage" numeric(5,2) NOT NULL,
  "total_marks"       integer NOT NULL DEFAULT 100,
  "assessment_count"  integer NOT NULL DEFAULT 1,
  "clo_mapped"        boolean NOT NULL DEFAULT false,
  "order_no"          integer NOT NULL DEFAULT 0,
  "created_by"        uuid,
  "updated_by"        uuid,
  "deleted_by"        uuid,
  "created_at"        timestamp NOT NULL DEFAULT now(),
  "updated_at"        timestamp NOT NULL DEFAULT now(),
  "deleted_at"        timestamp,
  CONSTRAINT "chk_weight_pct" CHECK ("weight_percentage" > 0 AND "weight_percentage" <= 100)
);--> statement-breakpoint
ALTER TABLE "course_assessment_components" ADD CONSTRAINT "cac_tenant_fk"  FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id")                ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "course_assessment_components" ADD CONSTRAINT "cac_plan_fk"    FOREIGN KEY ("plan_id")   REFERENCES "public"."course_assessment_plans"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "course_assessment_components" ADD CONSTRAINT "cac_created_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null;--> statement-breakpoint
ALTER TABLE "course_assessment_components" ADD CONSTRAINT "cac_updated_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null;--> statement-breakpoint
ALTER TABLE "course_assessment_components" ADD CONSTRAINT "cac_deleted_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null;--> statement-breakpoint

-- assessment_component_clos
CREATE TABLE IF NOT EXISTS "assessment_component_clos" (
  "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id"    uuid NOT NULL,
  "component_id" uuid NOT NULL,
  "clo_id"       uuid NOT NULL,
  "weight"       numeric(5,2) NOT NULL DEFAULT 100,
  "created_at"   timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "uq_assessment_component_clo" UNIQUE ("component_id","clo_id"),
  CONSTRAINT "chk_clo_weight" CHECK ("weight" > 0 AND "weight" <= 100)
);--> statement-breakpoint
ALTER TABLE "assessment_component_clos" ADD CONSTRAINT "acc_tenant_fk"    FOREIGN KEY ("tenant_id")    REFERENCES "public"."tenants"("id")                      ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "assessment_component_clos" ADD CONSTRAINT "acc_component_fk" FOREIGN KEY ("component_id") REFERENCES "public"."course_assessment_components"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "assessment_component_clos" ADD CONSTRAINT "acc_clo_fk"       FOREIGN KEY ("clo_id")       REFERENCES "public"."course_learning_outcomes"("id")      ON DELETE restrict;
