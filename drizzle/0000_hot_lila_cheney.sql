CREATE TABLE IF NOT EXISTS `activities` (
	`id` varchar(36) NOT NULL,
	`organizationId` varchar(36) NOT NULL,
	`domainId` varchar(36) NOT NULL,
	`code` varchar(60) NOT NULL,
	`name` varchar(160) NOT NULL,
	`status` varchar(40) NOT NULL DEFAULT 'active',
	`configVersion` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `assets` (
	`id` varchar(36) NOT NULL,
	`organizationId` varchar(36) NOT NULL,
	`businessUnitId` varchar(36),
	`operationId` varchar(36),
	`assetType` varchar(80) NOT NULL,
	`name` varchar(180) NOT NULL,
	`status` varchar(40) NOT NULL DEFAULT 'active',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `assets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `audit_events` (
	`id` varchar(36) NOT NULL,
	`organizationId` varchar(36) NOT NULL,
	`entityType` varchar(80) NOT NULL,
	`entityId` varchar(36) NOT NULL,
	`action` varchar(80) NOT NULL,
	`actorUserId` int,
	`previousValue` text,
	`newValue` text,
	`reason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `business_units` (
	`id` varchar(36) NOT NULL,
	`organizationId` varchar(36) NOT NULL,
	`parentId` varchar(36),
	`code` varchar(40) NOT NULL,
	`name` varchar(160) NOT NULL,
	`unitType` varchar(40) NOT NULL DEFAULT 'operation',
	`status` varchar(40) NOT NULL DEFAULT 'active',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `business_units_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `contracts` (
	`id` varchar(36) NOT NULL,
	`organizationId` varchar(36) NOT NULL,
	`businessUnitId` varchar(36),
	`operationId` varchar(36),
	`counterpartyId` varchar(36),
	`code` varchar(80) NOT NULL,
	`title` varchar(180) NOT NULL,
	`startDate` varchar(10),
	`endDate` varchar(10),
	`status` varchar(40) NOT NULL DEFAULT 'draft',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `contracts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `counterparties` (
	`id` varchar(36) NOT NULL,
	`organizationId` varchar(36) NOT NULL,
	`displayName` varchar(160) NOT NULL,
	`counterpartyType` varchar(40) NOT NULL DEFAULT 'other',
	`status` varchar(40) NOT NULL DEFAULT 'active',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `counterparties_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `data_catalog_fields` (
	`id` varchar(36) NOT NULL,
	`organizationId` varchar(36) NOT NULL,
	`fieldKey` varchar(80) NOT NULL,
	`label` varchar(160) NOT NULL,
	`definition` text NOT NULL,
	`owner` varchar(120) NOT NULL,
	`expectedSource` varchar(160) NOT NULL,
	`lineage` text NOT NULL,
	`domain` varchar(80) NOT NULL,
	`sensitivity` varchar(40) NOT NULL DEFAULT 'internal',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `data_catalog_fields_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `data_discrepancies` (
	`id` varchar(36) NOT NULL,
	`organizationId` varchar(36) NOT NULL,
	`dataRecordId` varchar(36) NOT NULL,
	`title` varchar(180) NOT NULL,
	`originalReading` text NOT NULL,
	`proposedCorrection` text,
	`justification` text,
	`status` varchar(40) NOT NULL DEFAULT 'open',
	`resolutionNote` text,
	`createdByUserId` int,
	`resolvedByUserId` int,
	`resolvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `data_discrepancies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `data_records` (
	`id` varchar(36) NOT NULL,
	`organizationId` varchar(36) NOT NULL,
	`entityType` varchar(80) NOT NULL,
	`entityId` varchar(36) NOT NULL,
	`fieldKey` varchar(80) NOT NULL,
	`label` varchar(160) NOT NULL,
	`value` text,
	`numericValue` decimal(16,4),
	`unit` varchar(30),
	`originType` varchar(40) NOT NULL DEFAULT 'manual',
	`sourceReference` varchar(240),
	`acquisitionMethod` varchar(40) NOT NULL DEFAULT 'manual_entry',
	`status` varchar(40) NOT NULL DEFAULT 'to_confirm',
	`quality` varchar(40) NOT NULL DEFAULT 'unknown',
	`approvalStatus` varchar(40) NOT NULL DEFAULT 'pending',
	`notes` text,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `data_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `documents` (
	`id` varchar(36) NOT NULL,
	`organizationId` varchar(36) NOT NULL,
	`businessUnitId` varchar(36),
	`documentType` varchar(100) NOT NULL,
	`title` varchar(180) NOT NULL,
	`reference` varchar(240),
	`status` varchar(40) NOT NULL DEFAULT 'pending',
	`originType` varchar(40) NOT NULL DEFAULT 'primary_document',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `domains` (
	`id` varchar(36) NOT NULL,
	`organizationId` varchar(36) NOT NULL,
	`code` varchar(40) NOT NULL,
	`name` varchar(120) NOT NULL,
	`description` text,
	`enabled` int NOT NULL DEFAULT 1,
	`configVersion` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `domains_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `economic_entries` (
	`id` varchar(36) NOT NULL,
	`organizationId` varchar(36) NOT NULL,
	`businessUnitId` varchar(36) NOT NULL,
	`resultCenterId` varchar(36),
	`lotId` varchar(36),
	`inputMovementId` varchar(36),
	`entryType` varchar(40) NOT NULL,
	`entryDate` varchar(10) NOT NULL,
	`amount` decimal(16,2) NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'BRL',
	`originType` varchar(40) NOT NULL DEFAULT 'manual',
	`sourceReference` varchar(240),
	`status` varchar(40) NOT NULL DEFAULT 'to_confirm',
	`notes` text,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `economic_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `field_configs` (
	`id` varchar(36) NOT NULL,
	`organizationId` varchar(36) NOT NULL,
	`domainId` varchar(36) NOT NULL,
	`fieldKey` varchar(80) NOT NULL,
	`fieldLabel` varchar(160) NOT NULL,
	`fieldType` varchar(40) NOT NULL DEFAULT 'text',
	`configVersion` int NOT NULL DEFAULT 1,
	`required` int NOT NULL DEFAULT 0,
	`status` varchar(40) NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `field_configs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `input_movements` (
	`id` varchar(36) NOT NULL,
	`organizationId` varchar(36) NOT NULL,
	`inputId` varchar(36) NOT NULL,
	`lotId` varchar(36),
	`movementType` varchar(40) NOT NULL,
	`movementDate` varchar(10) NOT NULL,
	`quantity` decimal(16,4) NOT NULL,
	`unitCost` decimal(16,4),
	`linkStatus` varchar(40) NOT NULL DEFAULT 'unlinked',
	`originType` varchar(40) NOT NULL DEFAULT 'manual',
	`sourceReference` varchar(240),
	`status` varchar(40) NOT NULL DEFAULT 'to_confirm',
	`notes` text,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `input_movements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `inputs` (
	`id` varchar(36) NOT NULL,
	`organizationId` varchar(36) NOT NULL,
	`sku` varchar(60) NOT NULL,
	`name` varchar(160) NOT NULL,
	`category` varchar(40) NOT NULL DEFAULT 'other',
	`unit` varchar(30) NOT NULL,
	`active` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inputs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `kpi_definitions` (
	`id` varchar(36) NOT NULL,
	`organizationId` varchar(36) NOT NULL,
	`code` varchar(60) NOT NULL,
	`name` varchar(160) NOT NULL,
	`definition` text NOT NULL,
	`formula` text NOT NULL,
	`unit` varchar(40) NOT NULL,
	`sources` text NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`status` varchar(40) NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `kpi_definitions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `livestock_lots` (
	`id` varchar(36) NOT NULL,
	`organizationId` varchar(36) NOT NULL,
	`businessUnitId` varchar(36) NOT NULL,
	`operationId` varchar(36),
	`lotCode` varchar(60) NOT NULL,
	`regime` varchar(40) NOT NULL DEFAULT 'feedlot',
	`headCount` int NOT NULL DEFAULT 0,
	`entryDate` varchar(10),
	`expectedExitDate` varchar(10),
	`actualExitDate` varchar(10),
	`status` varchar(40) NOT NULL DEFAULT 'active',
	`dataStatus` varchar(40) NOT NULL DEFAULT 'partial',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `livestock_lots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `lot_events` (
	`id` varchar(36) NOT NULL,
	`organizationId` varchar(36) NOT NULL,
	`lotId` varchar(36) NOT NULL,
	`eventType` varchar(40) NOT NULL,
	`eventDate` varchar(10) NOT NULL,
	`quantity` decimal(16,4),
	`unit` varchar(30),
	`originType` varchar(40) NOT NULL DEFAULT 'manual',
	`sourceReference` varchar(240),
	`status` varchar(40) NOT NULL DEFAULT 'to_confirm',
	`quality` varchar(40) NOT NULL DEFAULT 'unknown',
	`notes` text,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lot_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `operations` (
	`id` varchar(36) NOT NULL,
	`organizationId` varchar(36) NOT NULL,
	`businessUnitId` varchar(36) NOT NULL,
	`domainId` varchar(36) NOT NULL,
	`activityId` varchar(36),
	`resultCenterId` varchar(36),
	`code` varchar(60) NOT NULL,
	`name` varchar(180) NOT NULL,
	`startDate` varchar(10),
	`endDate` varchar(10),
	`status` varchar(40) NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `operations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `organization_members` (
	`id` varchar(36) NOT NULL,
	`organizationId` varchar(36) NOT NULL,
	`userId` int NOT NULL,
	`role` varchar(40) NOT NULL DEFAULT 'viewer',
	`status` varchar(40) NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `organization_members_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `organizations` (
	`id` varchar(36) NOT NULL,
	`name` varchar(160) NOT NULL,
	`slug` varchar(100) NOT NULL,
	`status` varchar(40) NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `organizations_id` PRIMARY KEY(`id`),
	CONSTRAINT `organizations_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `quality_alerts` (
	`id` varchar(36) NOT NULL,
	`organizationId` varchar(36) NOT NULL,
	`ruleId` varchar(36) NOT NULL,
	`entityType` varchar(80) NOT NULL,
	`entityId` varchar(36) NOT NULL,
	`message` text NOT NULL,
	`severity` varchar(40) NOT NULL DEFAULT 'medium',
	`status` varchar(40) NOT NULL DEFAULT 'open',
	`resolvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `quality_alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `quality_rules` (
	`id` varchar(36) NOT NULL,
	`organizationId` varchar(36) NOT NULL,
	`code` varchar(60) NOT NULL,
	`name` varchar(160) NOT NULL,
	`description` text NOT NULL,
	`severity` varchar(40) NOT NULL DEFAULT 'medium',
	`scope` varchar(100) NOT NULL,
	`condition` text NOT NULL,
	`active` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `quality_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `record_links` (
	`id` varchar(36) NOT NULL,
	`organizationId` varchar(36) NOT NULL,
	`fromType` varchar(80) NOT NULL,
	`fromId` varchar(36) NOT NULL,
	`toType` varchar(80) NOT NULL,
	`toId` varchar(36) NOT NULL,
	`linkType` varchar(80) NOT NULL,
	`status` varchar(40) NOT NULL DEFAULT 'candidate',
	`evidenceNote` text,
	`confirmedByUserId` int,
	`confirmedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `record_links_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `result_centers` (
	`id` varchar(36) NOT NULL,
	`organizationId` varchar(36) NOT NULL,
	`businessUnitId` varchar(36),
	`code` varchar(40) NOT NULL,
	`name` varchar(160) NOT NULL,
	`centerType` varchar(40) NOT NULL DEFAULT 'result',
	`status` varchar(40) NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `result_centers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `sessions` (
	`id` varchar(36) NOT NULL,
	`tokenHash` varchar(128) NOT NULL,
	`userId` int NOT NULL,
	`organizationId` varchar(36) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `sessions_tokenHash_unique` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`passwordHash` text,
	`loginMethod` varchar(64),
	`role` varchar(40) NOT NULL DEFAULT 'user',
	`status` varchar(40) NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);

--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `passwordHash` text;
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `status` varchar(40) NOT NULL DEFAULT 'active';
