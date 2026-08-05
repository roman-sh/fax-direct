CREATE TABLE IF NOT EXISTS `fax_session` (
	`id` integer PRIMARY KEY NOT NULL,
	`document_object_key` text,
	`document_original_name` text,
	`document_page_count` integer,
	`document_size_bytes` integer,
	`recipient_display_value` text,
	`recipient_e164` text,
	`quote_amount` text,
	`quote_currency` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "fax_session_singleton" CHECK("fax_session"."id" = 1),
	CONSTRAINT "fax_session_quote_currency" CHECK("fax_session"."quote_currency" IS NULL OR "fax_session"."quote_currency" = 'ILS')
);
