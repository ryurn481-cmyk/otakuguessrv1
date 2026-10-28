-- Version 2: preserve existing Anime data while allowing separate daily pools
-- for each medium and the new Panel mode.
ALTER TABLE "DailyChallenge" ADD COLUMN "contentType" TEXT NOT NULL DEFAULT 'ANIME';
ALTER TABLE "PracticeChallenge" ADD COLUMN "contentType" TEXT NOT NULL DEFAULT 'ANIME';

DROP INDEX IF EXISTS "DailyChallenge_date_mode_key";
CREATE UNIQUE INDEX "DailyChallenge_date_mode_contentType_key"
  ON "DailyChallenge"("date", "mode", "contentType");

ALTER TYPE "GameMode" ADD VALUE IF NOT EXISTS 'PANEL';
ALTER TYPE "GameMode" ADD VALUE IF NOT EXISTS 'PROP';
ALTER TYPE "GameMode" ADD VALUE IF NOT EXISTS 'EYES';

ALTER TABLE "Screenshot" ADD COLUMN "clueType" TEXT NOT NULL DEFAULT 'SCREENSHOT';
ALTER TABLE "Screenshot" ADD COLUMN "hint" TEXT;

CREATE TABLE "CharacterRound" (
  "id" TEXT NOT NULL,
  "challengeId" TEXT NOT NULL,
  "characterId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  CONSTRAINT "CharacterRound_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CharacterRound_challengeId_position_key" ON "CharacterRound"("challengeId", "position");
CREATE INDEX "CharacterRound_characterId_idx" ON "CharacterRound"("characterId");
ALTER TABLE "CharacterRound" ADD CONSTRAINT "CharacterRound_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "DailyChallenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CharacterRound" ADD CONSTRAINT "CharacterRound_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
