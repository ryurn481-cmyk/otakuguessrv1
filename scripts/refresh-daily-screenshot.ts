import { loadEnvConfig } from '@next/env';
import { PrismaClient } from '@prisma/client';

loadEnvConfig(process.cwd());

const prisma = new PrismaClient();

async function main() {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const challenge = await prisma.dailyChallenge.findUnique({ where: { date_mode_contentType: { date: today, mode: 'SCREENSHOT', contentType: 'ANIME' } } });
  if (!challenge?.animeId) throw new Error('No Screenshot challenge exists for today. Run daily:generate first.');

  const newestScreenshot = await prisma.screenshot.findFirst({
    where: { animeId: challenge.animeId },
    orderBy: { id: 'desc' },
  });
  if (!newestScreenshot) throw new Error('No Screenshot catalog entry exists for today\'s anime.');

  await prisma.dailyChallenge.update({ where: { id: challenge.id }, data: { screenshotId: newestScreenshot.id } });
  console.log('Today\'s Screenshot challenge now uses the newest catalog image.');
}

main()
  .catch((error) => { console.error('Could not refresh Screenshot challenge:', error); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
