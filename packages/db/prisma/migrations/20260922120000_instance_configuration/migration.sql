-- Instance configuration an operator supplies through the setup screen instead
-- of the .env file. Values are sealed before they reach this table; the server
-- never stores a credential it could read back without BETTER_AUTH_SECRET.
CREATE TYPE "UserRole" AS ENUM ('MEMBER', 'OPERATOR');

ALTER TABLE "user" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'MEMBER';

CREATE TABLE "instance_setting" (
  "key" TEXT NOT NULL,
  "sealed" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "updatedBy" TEXT,

  CONSTRAINT "instance_setting_pkey" PRIMARY KEY ("key")
);

-- One row for the whole setup lifecycle: the moment the first account signed in
-- and became the operator, and the moment the operator finished the wizard.
CREATE TABLE "instance_setup" (
  "id" TEXT NOT NULL DEFAULT 'singleton',
  "claimedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "instance_setup_pkey" PRIMARY KEY ("id")
);

-- An instance that already has accounts already runs from its environment, so
-- it counts as claimed and set up: its members keep their screens, and the
-- operator can still open the setup screen. The operator role goes to the
-- oldest verified account, so the next sign-up on an upgraded instance does not
-- take it; without an email provider no account is verified, and the oldest wins.
INSERT INTO "instance_setup" ("id", "claimedAt", "completedAt")
SELECT 'singleton', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "user");

UPDATE "user" SET "role" = 'OPERATOR'
WHERE "id" = (
  SELECT "id" FROM "user" ORDER BY "emailVerified" DESC, "createdAt", "id" LIMIT 1
);
