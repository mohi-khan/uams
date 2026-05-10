CREATE TYPE "public"."semester_offering_status" AS ENUM('planned', 'active', 'completed');--> statement-breakpoint
CREATE TABLE "course_offering_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"course_offering_id" uuid NOT NULL,
	"action" "audit_action" NOT NULL,
	"performed_by" uuid,
	"snapshot" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_offerings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"semester_offering_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"section" varchar(10) NOT NULL,
	"capacity" integer,
	"teacher_id" uuid,
	"schedule_info" jsonb,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "uq_course_off_sem_course_section" UNIQUE("tenant_id","semester_offering_id","course_id","section")
);
--> statement-breakpoint
CREATE TABLE "semester_offering_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"semester_offering_id" uuid NOT NULL,
	"action" "audit_action" NOT NULL,
	"performed_by" uuid,
	"snapshot" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "semester_offerings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"program_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"semester_no" integer NOT NULL,
	"status" "semester_offering_status" DEFAULT 'planned' NOT NULL,
	"start_date" date,
	"end_date" date,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "uq_sem_off_tenant_prog_session_semno" UNIQUE("tenant_id","program_id","session_id","semester_no")
);
--> statement-breakpoint
ALTER TABLE "course_offering_audit_logs" ADD CONSTRAINT "course_offering_audit_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_offering_audit_logs" ADD CONSTRAINT "course_offering_audit_logs_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_offerings" ADD CONSTRAINT "course_offerings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_offerings" ADD CONSTRAINT "course_offerings_semester_offering_id_semester_offerings_id_fk" FOREIGN KEY ("semester_offering_id") REFERENCES "public"."semester_offerings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_offerings" ADD CONSTRAINT "course_offerings_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_offerings" ADD CONSTRAINT "course_offerings_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_offerings" ADD CONSTRAINT "course_offerings_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_offerings" ADD CONSTRAINT "course_offerings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_offerings" ADD CONSTRAINT "course_offerings_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "semester_offering_audit_logs" ADD CONSTRAINT "semester_offering_audit_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "semester_offering_audit_logs" ADD CONSTRAINT "semester_offering_audit_logs_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "semester_offerings" ADD CONSTRAINT "semester_offerings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "semester_offerings" ADD CONSTRAINT "semester_offerings_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "semester_offerings" ADD CONSTRAINT "semester_offerings_session_id_academic_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."academic_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "semester_offerings" ADD CONSTRAINT "semester_offerings_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "semester_offerings" ADD CONSTRAINT "semester_offerings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "semester_offerings" ADD CONSTRAINT "semester_offerings_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;