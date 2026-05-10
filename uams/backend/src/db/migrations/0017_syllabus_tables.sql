-- syllabus_status enum
DO $$ BEGIN
  CREATE TYPE "public"."syllabus_status" AS ENUM('draft', 'final');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

-- course_syllabi
CREATE TABLE IF NOT EXISTS "course_syllabi" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id"  uuid NOT NULL,
  "course_id"  uuid NOT NULL,
  "version"    varchar(10) NOT NULL,
  "is_default" boolean NOT NULL DEFAULT false,
  "status"     "syllabus_status" NOT NULL DEFAULT 'draft',
  "created_by" uuid,
  "updated_by" uuid,
  "deleted_by" uuid,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "deleted_at" timestamp,
  CONSTRAINT "uq_syllabus_tenant_course_version" UNIQUE ("tenant_id","course_id","version")
);--> statement-breakpoint

ALTER TABLE "course_syllabi"
  ADD CONSTRAINT "course_syllabi_tenant_id_tenants_id_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_syllabi"
  ADD CONSTRAINT "course_syllabi_course_id_courses_id_fk"
    FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_syllabi"
  ADD CONSTRAINT "course_syllabi_created_by_users_id_fk"
    FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_syllabi"
  ADD CONSTRAINT "course_syllabi_updated_by_users_id_fk"
    FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_syllabi"
  ADD CONSTRAINT "course_syllabi_deleted_by_users_id_fk"
    FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

-- syllabus_audit_logs
CREATE TABLE IF NOT EXISTS "syllabus_audit_logs" (
  "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id"    uuid NOT NULL,
  "syllabus_id"  uuid NOT NULL,
  "action"       "audit_action" NOT NULL,
  "performed_by" uuid,
  "snapshot"     jsonb,
  "created_at"   timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint

ALTER TABLE "syllabus_audit_logs"
  ADD CONSTRAINT "syllabus_audit_logs_tenant_id_tenants_id_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "syllabus_audit_logs"
  ADD CONSTRAINT "syllabus_audit_logs_performed_by_users_id_fk"
    FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

-- syllabus_topics
CREATE TABLE IF NOT EXISTS "syllabus_topics" (
  "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id"       uuid NOT NULL,
  "syllabus_id"     uuid NOT NULL,
  "title"           varchar(255) NOT NULL,
  "description"     text,
  "status"          "syllabus_status" NOT NULL DEFAULT 'draft',
  "order_no"        integer NOT NULL DEFAULT 0,
  "estimated_hours" numeric(5,1),
  "created_by"      uuid,
  "updated_by"      uuid,
  "created_at"      timestamp NOT NULL DEFAULT now(),
  "updated_at"      timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint

ALTER TABLE "syllabus_topics"
  ADD CONSTRAINT "syllabus_topics_tenant_id_tenants_id_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "syllabus_topics"
  ADD CONSTRAINT "syllabus_topics_syllabus_id_course_syllabi_id_fk"
    FOREIGN KEY ("syllabus_id") REFERENCES "public"."course_syllabi"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "syllabus_topics"
  ADD CONSTRAINT "syllabus_topics_created_by_users_id_fk"
    FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "syllabus_topics"
  ADD CONSTRAINT "syllabus_topics_updated_by_users_id_fk"
    FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
