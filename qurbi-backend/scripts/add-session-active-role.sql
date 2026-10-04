-- QURBI dual buyer/farmer accounts (MySQL 8+).
-- A farmer account can also act as a buyer; each login session remembers
-- which role it is currently acting as. Nullable: existing sessions fall back
-- to the account's own role.

ALTER TABLE `refresh_tokens`
  ADD COLUMN IF NOT EXISTS `activeRole` ENUM('buyer', 'farmer', 'admin') NULL;
