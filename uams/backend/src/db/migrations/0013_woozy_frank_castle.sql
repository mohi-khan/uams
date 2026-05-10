CREATE TYPE "public"."offering_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TABLE "program_offering_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"offering_id" uuid NOT NULL,
	"action" "audit_action" NOT NULL,
	"performed_by" uuid,
	"snapshot" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "program_offerings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"program_id" uuid NOT NULL,
	"academic_session_id" uuid NOT NULL,
	"admission_start_date" date,
	"admission_end_date" date,
	"capacity" integer,
	"status" "offering_status" DEFAULT 'open' NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "uq_program_offering" UNIQUE("tenant_id","program_id","academic_session_id")
);
--> statement-breakpoint
ALTER TABLE "student_enrollments" ADD COLUMN "program_offering_id" uuid;--> statement-breakpoint
ALTER TABLE "program_offering_audit_logs" ADD CONSTRAINT "program_offering_audit_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_offering_audit_logs" ADD CONSTRAINT "program_offering_audit_logs_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_offerings" ADD CONSTRAINT "program_offerings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_offerings" ADD CONSTRAINT "program_offerings_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_offerings" ADD CONSTRAINT "program_offerings_academic_session_id_academic_sessions_id_fk" FOREIGN KEY ("academic_session_id") REFERENCES "public"."academic_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_offerings" ADD CONSTRAINT "program_offerings_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_offerings" ADD CONSTRAINT "program_offerings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_offerings" ADD CONSTRAINT "program_offerings_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_enrollments" ADD CONSTRAINT "student_enrollments_program_offering_id_program_offerings_id_fk" FOREIGN KEY ("program_offering_id") REFERENCES "public"."program_offerings"("id") ON DELETE restrict ON UPDATE no action;