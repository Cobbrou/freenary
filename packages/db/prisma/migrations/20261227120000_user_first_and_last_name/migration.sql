-- Better Auth's `name` becomes the first name, so the column keeps its data.
ALTER TABLE "user" RENAME COLUMN "name" TO "firstName";

-- AlterTable
ALTER TABLE "user" ADD COLUMN "lastName" TEXT;

-- Split each former name at its first space: the first word is the first
-- name, the rest the last name. "Marius" keeps no last name. The first name,
-- a space and the last name give back the former name, spaces collapsed.
UPDATE "user" AS u
SET "firstName" = split."firstName",
    "lastName" = split."lastName"
FROM (
    SELECT id,
           substring(cleaned FROM '^\S+') AS "firstName",
           NULLIF(substring(cleaned FROM '^\S+\s+(.*)$'), '') AS "lastName"
    FROM (
        SELECT id, btrim(regexp_replace("firstName", '\s+', ' ', 'g')) AS cleaned
        FROM "user"
    ) AS normalised
    WHERE cleaned <> ''
) AS split
WHERE u.id = split.id;
