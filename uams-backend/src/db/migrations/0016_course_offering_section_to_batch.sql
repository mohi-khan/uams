-- Drop old unique constraint that includes section
ALTER TABLE "course_offerings" DROP CONSTRAINT "uq_course_off_sem_course_section";--> statement-breakpoint

-- Drop the section column
ALTER TABLE "course_offerings" DROP COLUMN "section";--> statement-breakpoint

-- Add batch_id column (nullable FK → batches)
ALTER TABLE "course_offerings" ADD COLUMN "batch_id" uuid;--> statement-breakpoint

-- Add FK constraint
ALTER TABLE "course_offerings" ADD CONSTRAINT "course_offerings_batch_id_batches_id_fk"
  FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

-- Add new unique constraint on (tenant_id, semester_offering_id, course_id, batch_id)
ALTER TABLE "course_offerings" ADD CONSTRAINT "uq_course_off_sem_course_batch"
  UNIQUE ("tenant_id", "semester_offering_id", "course_id", "batch_id");
