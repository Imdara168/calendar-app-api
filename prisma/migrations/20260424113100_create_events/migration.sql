CREATE TABLE `events` (
  `id` CHAR(36) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT NOT NULL,
  `date` VARCHAR(10) NOT NULL,
  `start_time` VARCHAR(5) NOT NULL,
  `end_time` VARCHAR(5) NOT NULL,
  `status` VARCHAR(50) NOT NULL,
  `category` VARCHAR(50) NOT NULL,
  `user_link` INT NOT NULL,
  `event_attendees` JSON NULL,
  `event_attachments` JSON NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  INDEX `IDX_events_user_link`(`user_link`),
  INDEX `IDX_events_date`(`date`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci ENGINE InnoDB;

ALTER TABLE `events`
  ADD CONSTRAINT `FK_events_user_link`
  FOREIGN KEY (`user_link`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
