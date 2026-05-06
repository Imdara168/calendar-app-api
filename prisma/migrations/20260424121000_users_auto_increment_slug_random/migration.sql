ALTER TABLE `events`
  DROP FOREIGN KEY `FK_events_user_link`;

ALTER TABLE `users`
  ADD COLUMN `new_id` INT NOT NULL AUTO_INCREMENT UNIQUE FIRST;

ALTER TABLE `events`
  ADD COLUMN `new_user_link` INT NULL;

UPDATE `events` e
JOIN `users` u ON e.`user_link` = CAST(u.`id` AS CHAR(36))
SET e.`new_user_link` = u.`new_id`;

ALTER TABLE `users`
  DROP PRIMARY KEY,
  DROP COLUMN `id`,
  CHANGE COLUMN `new_id` `id` INT NOT NULL AUTO_INCREMENT,
  ADD PRIMARY KEY (`id`);

ALTER TABLE `events`
  DROP COLUMN `user_link`,
  CHANGE COLUMN `new_user_link` `user_link` INT NOT NULL;

ALTER TABLE `events`
  ADD CONSTRAINT `FK_events_user_link`
  FOREIGN KEY (`user_link`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
