CREATE TABLE `organization_features` (
	`id` varchar(36) NOT NULL,
	`organizationId` varchar(36) NOT NULL,
	`featureKey` varchar(100) NOT NULL,
	`enabled` int NOT NULL DEFAULT 0,
	`source` varchar(40) NOT NULL DEFAULT 'plan',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `organization_features_id` PRIMARY KEY(`id`),
	CONSTRAINT `organization_features_organization_feature_uq` UNIQUE(`organizationId`,`featureKey`)
);
--> statement-breakpoint
CREATE TABLE `organization_invitations` (
	`id` varchar(36) NOT NULL,
	`organizationId` varchar(36) NOT NULL,
	`email` varchar(320) NOT NULL,
	`role` varchar(40) NOT NULL DEFAULT 'viewer',
	`tokenHash` varchar(128) NOT NULL,
	`invitedByUserId` int NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`acceptedAt` timestamp,
	`revokedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `organization_invitations_id` PRIMARY KEY(`id`),
	CONSTRAINT `organization_invitations_tokenHash_unique` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
CREATE TABLE `platform_audit_events` (
	`id` varchar(36) NOT NULL,
	`actorUserId` int NOT NULL,
	`action` varchar(100) NOT NULL,
	`targetType` varchar(80) NOT NULL,
	`targetId` varchar(100) NOT NULL,
	`previousValue` longtext,
	`newValue` longtext,
	`reason` text,
	`ipAddress` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `platform_audit_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `organizations` ADD `plan` varchar(40) DEFAULT 'trial' NOT NULL;--> statement-breakpoint
ALTER TABLE `organizations` ADD `billingStatus` varchar(40) DEFAULT 'trialing' NOT NULL;--> statement-breakpoint
ALTER TABLE `organizations` ADD `seatLimit` int DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE `organizations` ADD `trialEndsAt` timestamp;--> statement-breakpoint
ALTER TABLE `organizations` ADD `suspendedAt` timestamp;--> statement-breakpoint
ALTER TABLE `organizations` ADD `suspensionReason` text;--> statement-breakpoint
ALTER TABLE `users` ADD `platformRole` varchar(40) DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `organization_members` ADD CONSTRAINT `organization_members_organization_user_uq` UNIQUE(`organizationId`,`userId`);--> statement-breakpoint
CREATE INDEX `organization_features_organization_idx` ON `organization_features` (`organizationId`);--> statement-breakpoint
CREATE INDEX `organization_invitations_organization_idx` ON `organization_invitations` (`organizationId`);--> statement-breakpoint
CREATE INDEX `organization_invitations_email_idx` ON `organization_invitations` (`email`);--> statement-breakpoint
CREATE INDEX `platform_audit_target_idx` ON `platform_audit_events` (`targetType`,`targetId`);--> statement-breakpoint
CREATE INDEX `platform_audit_actor_idx` ON `platform_audit_events` (`actorUserId`);--> statement-breakpoint
CREATE INDEX `platform_audit_created_idx` ON `platform_audit_events` (`createdAt`);--> statement-breakpoint
CREATE INDEX `organization_members_organization_idx` ON `organization_members` (`organizationId`);--> statement-breakpoint
CREATE INDEX `organization_members_user_idx` ON `organization_members` (`userId`);