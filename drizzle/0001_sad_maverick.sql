PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_fax_session` (
	`id` integer PRIMARY KEY NOT NULL,
	`document_object_key` text,
	`document_original_name` text,
	`document_page_count` integer,
	`document_size_bytes` integer,
	`recipient_display_value` text,
	`recipient_e164` text,
	`quote_amount` text,
	`quote_currency` text,
	`payment_status` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "fax_session_singleton" CHECK("__new_fax_session"."id" = 1),
	CONSTRAINT "fax_session_quote_currency" CHECK("__new_fax_session"."quote_currency" IS NULL OR "__new_fax_session"."quote_currency" = 'ILS'),
	CONSTRAINT "fax_session_payment_status" CHECK("__new_fax_session"."payment_status" IS NULL OR "__new_fax_session"."payment_status" IN ('pending', 'paid'))
);
--> statement-breakpoint
INSERT INTO `__new_fax_session`("id", "document_object_key", "document_original_name", "document_page_count", "document_size_bytes", "recipient_display_value", "recipient_e164", "quote_amount", "quote_currency", "payment_status", "updated_at") SELECT "id", "document_object_key", "document_original_name", "document_page_count", "document_size_bytes", "recipient_display_value", "recipient_e164", "quote_amount", "quote_currency", NULL, "updated_at" FROM `fax_session`;--> statement-breakpoint
DROP TABLE `fax_session`;--> statement-breakpoint
ALTER TABLE `__new_fax_session` RENAME TO `fax_session`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
