ALTER TABLE "account_recovery_abuse_limits"
  DROP CONSTRAINT "account_recovery_abuse_scope_check";
--> statement-breakpoint
ALTER TABLE "account_recovery_abuse_limits"
  ADD CONSTRAINT "account_recovery_abuse_scope_check"
  CHECK ("scope" in ('email_verify_request','password_reset_request','password_reset_confirm'));
