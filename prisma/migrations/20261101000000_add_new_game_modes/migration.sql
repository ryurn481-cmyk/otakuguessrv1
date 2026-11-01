-- Extend content fields used by AniLink and StatDuel.
ALTER TABLE "Anime"
  ADD COLUMN "chapters" INTEGER,
  ADD COLUMN "volumes" INTEGER,
  ADD COLUMN "author" TEXT,
  ADD COLUMN "artist" TEXT,
  ADD COLUMN "publisher" TEXT,
  ADD COLUMN "magazine" TEXT,
  ADD COLUMN "director" TEXT,
  ADD COLUMN "composer" TEXT,
  ADD COLUMN "sourceTitle" TEXT,
  ADD COLUMN "sourceMangaId" TEXT;

ALTER TYPE "GameMode" ADD VALUE IF NOT EXISTS 'ANILINK';
ALTER TYPE "GameMode" ADD VALUE IF NOT EXISTS 'STATDUEL';
ALTER TYPE "GameMode" ADD VALUE IF NOT EXISTS 'SAKUGASYNC';

CREATE TABLE "AniLinkChallenge" (
  "id" TEXT NOT NULL,
  "dailyChallengeId" TEXT NOT NULL,
  "startAnimeId" TEXT NOT NULL,
  "targetAnimeId" TEXT NOT NULL,
  "minimumHops" INTEGER NOT NULL,
  CONSTRAINT "AniLinkChallenge_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AniLinkChallenge_dailyChallengeId_key" ON "AniLinkChallenge"("dailyChallengeId");
ALTER TABLE "AniLinkChallenge" ADD CONSTRAINT "AniLinkChallenge_dailyChallengeId_fkey" FOREIGN KEY ("dailyChallengeId") REFERENCES "DailyChallenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AniLinkChallenge" ADD CONSTRAINT "AniLinkChallenge_startAnimeId_fkey" FOREIGN KEY ("startAnimeId") REFERENCES "Anime"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AniLinkChallenge" ADD CONSTRAINT "AniLinkChallenge_targetAnimeId_fkey" FOREIGN KEY ("targetAnimeId") REFERENCES "Anime"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "StatDuelChallenge" (
  "id" TEXT NOT NULL,
  "dailyChallengeId" TEXT NOT NULL,
  "pairsJson" TEXT NOT NULL,
  "seed" INTEGER NOT NULL,
  CONSTRAINT "StatDuelChallenge_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StatDuelChallenge_dailyChallengeId_key" ON "StatDuelChallenge"("dailyChallengeId");
ALTER TABLE "StatDuelChallenge" ADD CONSTRAINT "StatDuelChallenge_dailyChallengeId_fkey" FOREIGN KEY ("dailyChallengeId") REFERENCES "DailyChallenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SakugaSyncChallenge" (
  "id" TEXT NOT NULL,
  "dailyChallengeId" TEXT NOT NULL,
  "targetDurationsJson" TEXT NOT NULL,
  "seed" INTEGER NOT NULL,
  CONSTRAINT "SakugaSyncChallenge_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SakugaSyncChallenge_dailyChallengeId_key" ON "SakugaSyncChallenge"("dailyChallengeId");
ALTER TABLE "SakugaSyncChallenge" ADD CONSTRAINT "SakugaSyncChallenge_dailyChallengeId_fkey" FOREIGN KEY ("dailyChallengeId") REFERENCES "DailyChallenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
