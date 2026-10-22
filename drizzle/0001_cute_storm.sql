CREATE TABLE `import_batches` (
	`id` varchar(36) NOT NULL,
	`organizationId` varchar(36) NOT NULL,
	`businessUnitId` varchar(36),
	`sourceFilename` varchar(240) NOT NULL,
	`sourceMimeType` varchar(120),
	`sourceFormat` varchar(40) NOT NULL,
	`sourceHash` varchar(64) NOT NULL,
	`sourceSize` int NOT NULL,
	`sourceContent` longtext NOT NULL,
	`targetEntity` varchar(40) NOT NULL,
	`headers` longtext NOT NULL,
	`mapping` longtext NOT NULL,
	`status` varchar(40) NOT NULL DEFAULT 'uploaded',
	`totalRows` int NOT NULL DEFAULT 0,
	`validRows` int NOT NULL DEFAULT 0,
	`invalidRows` int NOT NULL DEFAULT 0,
	`duplicateRows` int NOT NULL DEFAULT 0,
	`errorSummary` longtext,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `import_batches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `import_rows` (
	`id` varchar(36) NOT NULL,
	`organizationId` varchar(36) NOT NULL,
	`batchId` varchar(36) NOT NULL,
	`rowNumber` int NOT NULL,
	`sourceData` longtext NOT NULL,
	`normalizedData` longtext,
	`status` varchar(40) NOT NULL DEFAULT 'pending',
	`errors` longtext,
	`targetId` varchar(36),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `import_rows_id` PRIMARY KEY(`id`)
);
