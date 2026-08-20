CREATE TABLE `fax_transmissions` (
	`transaction_id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`delivery_attempt` integer DEFAULT 1 NOT NULL,
	`provider_status` integer,
	`pages_submitted` integer NOT NULL,
	`pages_sent` integer NOT NULL,
	`attempts_made` integer NOT NULL,
	`attempts_total` integer NOT NULL,
	`resolution` text NOT NULL,
	`submitted_at` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`completed_at` text,
	CONSTRAINT "fax_transmissions_resolution" CHECK("fax_transmissions"."resolution" IN ('Fine', 'Standard')),
	CONSTRAINT "fax_transmissions_page_counts" CHECK("fax_transmissions"."pages_submitted" >= 0 AND "fax_transmissions"."pages_sent" >= 0),
	CONSTRAINT "fax_transmissions_attempt_counts" CHECK("fax_transmissions"."attempts_made" >= 0 AND "fax_transmissions"."attempts_total" >= 0),
	CONSTRAINT "fax_transmissions_delivery_attempt" CHECK("fax_transmissions"."delivery_attempt" >= 1)
);
--> statement-breakpoint
CREATE INDEX `fax_transmissions_provider_status_idx` ON `fax_transmissions` (`provider_status`);--> statement-breakpoint
CREATE INDEX `fax_transmissions_session_id_idx` ON `fax_transmissions` (`session_id`);--> statement-breakpoint
CREATE TABLE `payments` (
	`session_id` text PRIMARY KEY NOT NULL,
	`payme_sale_id` text NOT NULL,
	`payme_sale_code` integer NOT NULL,
	`checkout_url` text NOT NULL,
	`amount_minor_units` integer NOT NULL,
	`currency` text NOT NULL,
	`payment_method` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "payments_positive_amount" CHECK("payments"."amount_minor_units" > 0),
	CONSTRAINT "payments_status" CHECK("payments"."status" IN ('initiated', 'pending', 'paid', 'failed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payments_payme_sale_id_unique` ON `payments` (`payme_sale_id`);