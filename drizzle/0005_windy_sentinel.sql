ALTER TABLE `import_rows` ADD CONSTRAINT `import_rows_batch_row_uq` UNIQUE(`batchId`,`rowNumber`);--> statement-breakpoint
CREATE INDEX `import_batches_organization_status_idx` ON `import_batches` (`organizationId`,`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `import_rows_batch_status_idx` ON `import_rows` (`organizationId`,`batchId`,`status`,`rowNumber`);