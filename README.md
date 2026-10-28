# OtakuGuessr

Daily anime quiz games built with Next.js, PostgreSQL, Prisma, and AniList metadata.

## Local setup

1. Copy `.env.example` to `.env.local` and set `DATABASE_URL` to your PostgreSQL database.
2. Generate the Prisma client and create the schema:

   ```powershell
   npm.cmd run db:generate
   npm.cmd run db:push
   ```

3. Seed popular anime and their characters from AniList:

   ```powershell
   npm.cmd run db:seed
   ```

4. Create the current UTC day's challenges:

   ```powershell
   npm.cmd run daily:generate
   ```

   After replacing an image for an anime already selected today, run `npm.cmd run daily:refresh-screenshot` to make today use the newest seeded image.

5. Start the application:

   ```powershell
   npm.cmd run dev
   ```

## Screenshot and Opening media

AniList provides anime metadata and character artwork, but not game-ready screenshots or opening audio. Add only media you are licensed to host:

1. Copy `prisma/content-catalog.example.json` to `prisma/content-catalog.json`. The `example` file is documentation only; the seed script intentionally never reads it.
2. Replace the example URLs with URLs from your own storage/CDN and use valid AniList IDs.
3. Run `npm.cmd run db:seed`, then `npm.cmd run daily:generate`.

`prisma/content-catalog.json` is deliberately ignored by Git so private CDN URLs and your editorial catalog are not committed. Each selected mode requires at least one corresponding content item before its daily challenge can be generated.

For production, upload licensed image and audio files to storage you control (for example Cloudinary, S3/R2, or another CDN), then run the seed script once against the production database with the private catalog present. The database retains the imported records; the catalog file is not required by the running application. AniList supplies anime metadata and character artwork, but it does not provide reusable screenshot or opening-audio assets.

Character and Anidle variety comes from AniList. Set `ANILIST_SEED_PAGES` to a larger value (for example `20`) before running `npm.cmd run db:seed` to import up to roughly 1,000 popular anime and their associated characters instead of the default 100.

Opening mode is disabled by default in the public UI and its daily API does not return audio unless `OPENING_MODE_ENABLED=true`. Only enable it after every catalog entry has a verified, production-appropriate license.

## Prop Guess and Eyes Only assets

Keep approved source-image details in a private `prisma/clue-assets.json` (copy `prisma/clue-assets.example.json`). Each entry requires a direct image URL, AniList ID, clue type, license reference, and attribution. Then upload and sync it:

```powershell
npm.cmd run clues:upload
npm.cmd run db:seed
```

The uploader stores Props in `otakuguessr/clues/props` and Eyes in `otakuguessr/clues/eyes` on Cloudinary, writes their secure delivery URLs to the private catalog, and retains source/license metadata in Cloudinary.

## Automation

The protected endpoint `POST /api/cron/generate-daily` creates tomorrow's UTC challenges. Set `CRON_SECRET` and send it as `Authorization: Bearer <CRON_SECRET>`. The included Vercel cron configuration should invoke it daily before UTC midnight.

## Practice mode

`/anidle/practice`, `/character/practice`, and `/screenshot/practice` start fresh, one-hour practice puzzles. Practice answers stay server-side and do not affect daily scores or streaks. Screenshot practice repeats available catalog entries when the catalog is small.
