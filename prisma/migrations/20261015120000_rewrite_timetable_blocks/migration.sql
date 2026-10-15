-- Rewrite timetable: blocks now carry the days of the week they repeat on.
-- Templates and weekday assignments are removed.

-- 1. Add the `days` column to TimetableBlock.
ALTER TABLE "TimetableBlock" ADD COLUMN "days" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];

-- 2. Preserve existing blocks by assigning them to the weekday group (Mon-Fri).
UPDATE "TimetableBlock" SET "days" = ARRAY[1, 2, 3, 4, 5];

-- 3. Drop template-specific columns / constraints from TimetableBlock.
DROP INDEX IF EXISTS "TimetableBlock_templateId_idx";
ALTER TABLE "TimetableBlock" DROP CONSTRAINT IF EXISTS "TimetableBlock_templateId_fkey";
ALTER TABLE "TimetableBlock" DROP COLUMN "templateId";
ALTER TABLE "TimetableBlock" DROP COLUMN "order";
ALTER TABLE "TimetableBlock" DROP COLUMN "isRecurring";

-- 4. Drop WeekdayTemplate (depends on TimetableTemplate).
ALTER TABLE "WeekdayTemplate" DROP CONSTRAINT IF EXISTS "WeekdayTemplate_templateId_fkey";
ALTER TABLE "WeekdayTemplate" DROP CONSTRAINT IF EXISTS "WeekdayTemplate_userId_fkey";
DROP TABLE "WeekdayTemplate";

-- 5. Drop TimetableTemplate.
ALTER TABLE "TimetableTemplate" DROP CONSTRAINT IF EXISTS "TimetableTemplate_userId_fkey";
DROP TABLE "TimetableTemplate";
