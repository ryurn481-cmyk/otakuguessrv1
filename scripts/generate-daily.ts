import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());

import { generateDailyChallenges, getTodayUTC } from '../src/lib/daily';
import { prisma } from '../src/lib/prisma';

function parseDate(value: string | undefined): Date {
  if (!value) return getTodayUTC();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('Use a UTC date in YYYY-MM-DD form, for example: npm run daily:generate -- 2026-10-24');
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`Invalid date: ${value}`);
  }
  return date;
}

async function main() {
  const date = parseDate(process.argv[2]);
  const results = await generateDailyChallenges(date);
  console.table(results);
}

main()
  .catch((error) => {
    console.error('Daily challenge generation failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
