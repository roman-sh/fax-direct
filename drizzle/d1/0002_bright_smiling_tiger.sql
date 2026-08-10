PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_fax_transmissions` (
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
	CONSTRAINT "fax_transmissions_resolution" CHECK("__new_fax_transmissions"."resolution" IN ('Fine', 'Standard')),
	CONSTRAINT "fax_transmissions_page_counts" CHECK("__new_fax_transmissions"."pages_submitted" >= 0 AND "__new_fax_transmissions"."pages_sent" >= 0),
	CONSTRAINT "fax_transmissions_attempt_counts" CHECK("__new_fax_transmissions"."attempts_made" >= 0 AND "__new_fax_transmissions"."attempts_total" >= 0),
	CONSTRAINT "fax_transmissions_delivery_attempt" CHECK("__new_fax_transmissions"."delivery_attempt" >= 1)
);
--> statement-breakpoint
INSERT INTO `__new_fax_transmissions`("transaction_id", "session_id", "delivery_attempt", "provider_status", "pages_submitted", "pages_sent", "attempts_made", "attempts_total", "resolution", "submitted_at", "updated_at", "completed_at") SELECT "transaction_id", "session_id", 1, "provider_status", "pages_submitted", "pages_sent", "attempts_made", "attempts_total", "resolution", "submitted_at", "updated_at", "completed_at" FROM `fax_transmissions`;--> statement-breakpoint
DROP TABLE `fax_transmissions`;--> statement-breakpoint
ALTER TABLE `__new_fax_transmissions` RENAME TO `fax_transmissions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `fax_transmissions_provider_status_idx` ON `fax_transmissions` (`provider_status`);--> statement-breakpoint
CREATE INDEX `fax_transmissions_session_id_idx` ON `fax_transmissions` (`session_id`);