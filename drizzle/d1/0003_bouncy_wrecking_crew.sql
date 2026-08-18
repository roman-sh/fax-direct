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
	CONSTRAINT "payments_status" CHECK("payments"."status" IN ('pending', 'paid', 'failed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payments_payme_sale_id_unique` ON `payments` (`payme_sale_id`);