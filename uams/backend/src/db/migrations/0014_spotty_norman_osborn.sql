ALTER TABLE "students" ADD COLUMN "gmail_account" varchar(255);--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "uq_students_tenant_gmail" UNIQUE("tenant_id","gmail_account");