CREATE TABLE `fax_transmissions` (
	`transaction_id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`status` text DEFAULT 'processing' NOT NULL,
	`provider_status` integer NOT NULL,
	`pages_submitted` integer NOT NULL,
	`pages_sent` integer NOT NULL,
	`attempts_made` integer NOT NULL,
	`attempts_total` integer NOT NULL,
	`resolution` text NOT NULL,
	`submitted_at` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`completed_at` text,
	CONSTRAINT "fax_transmissions_status" CHECK("fax_transmissions"."status" IN ('processing', 'delivered', 'failed')),
	CONSTRAINT "fax_transmissions_resolution" CHECK("fax_transmissions"."resolution" IN ('Fine', 'Standard')),
	CONSTRAINT "fax_transmissions_page_counts" CHECK("fax_transmissions"."pages_submitted" >= 0 AND "fax_transmissions"."pages_sent" >= 0),
	CONSTRAINT "fax_transmissions_attempt_counts" CHECK("fax_transmissions"."attempts_made" >= 0 AND "fax_transmissions"."attempts_total" >= 0)
);
--> statement-breakpoint
CREATE INDEX `fax_transmissions_status_idx` ON `fax_transmissions` (`status`);--> statement-breakpoint
CREATE INDEX `fax_transmissions_session_id_idx` ON `fax_transmissions` (`session_id`);