
What is Done
1. Project Scaffolding & Setup
  - Next.js application scaffolded with TypeScript and Tailwind CSS.
  - Core production dependencies installed: @prisma/client, prisma, next-auth (v5), @auth/prisma-adapter, @upstash/redis, @upstash/ratelimit, bcryptjs, zod, lucide-react, canvas-confetti, framer-motion, sonner, date-fns, Radix UI primitives.
  - Script approvals completed (npm approve-scripts).
  - Configuration files setup: next.config.ts, tsconfig.seed.json, package.json.
2. Database & Data Modeling
  - schema.prisma created with complete models: Anime, Character, Screenshot, Opening, DailyChallenge, User, Account, Session, VerificationToken, Score, and Streak (with contentType extension points).
3. Core Libraries & Business Logic (src/lib/)
  - prisma.ts – Prisma client singleton.
  - auth.ts – NextAuth v5 setup (Credentials + Google/Discord providers, JWT session strategy, streak initialization).
  - redis.ts – Upstash Redis client with safe fallback wrappers, cache keys, and TTL policies.
  - ratelimit.ts – Sliding window rate limiters for game submissions and search queries.
  - score.ts – Points calculation, speed bonus tiers, and 8-attribute Anidle comparison logic.
  - streak.ts – Daily streak tracking, longest streak, streak freeze redemption & 7-day milestone earning.
  - daily.ts – Daily challenge fetching, 30-day anti-repeat weighted random selection, daily generation logic.
  - share.ts – Emoji grid & spoiler-safe share card generator for all 4 game modes.
  - anilist.ts – AniList GraphQL client with retry and rate-limit handling.
  - utils.ts – Tailwind cn, countdown timer calculations, and formatting.
4. Type Definitions & Constants
  - types/game.ts, types/anime.ts – Game modes, feedback models, and challenge shapes.
  - constants/game.ts, constants/attributes.ts – Points, deductions, blur steps, audio intervals, and Anidle attributes.
5. Complete API Layer (src/app/api/)
  - Auth routes: NextAuth handler api/auth/[...nextauth] and user registration api/auth/register.
  - Daily challenge endpoints (answer-stripped): api/daily/screenshot, api/daily/character, api/daily/opening, api/daily/anidle.
  - Game submission & guess verification endpoints: api/game/screenshot/submit, api/game/character/submit, api/game/opening/submit, api/game/anidle/guess.
  - Search endpoints: api/search/anime and api/search/character.
  - Social / Progression: api/leaderboard, api/streak.
  - Automation: api/cron/generate-daily.
6. Daily Game Frontend (initial production UI)
  - Shared landing page, navigation, footer, and mode selection are implemented.
  - /anidle is playable with debounced anime search, attribute feedback, and completion state.
  - /screenshot is playable with daily challenge loading, progressive CSS blur reveal, answer submission, and completion state.
  - /character is playable with a progressive silhouette reveal, character search suggestions, and completion state.
  - /opening is playable with bounded, progressively longer audio clips, anime search suggestions, and completion state.
  - Screenshot submissions persist only when a player wins or uses the final attempt, allowing signed-in players to make all six guesses.
  - Character submissions follow the same final-attempt persistence rule.
  - Opening submissions follow the same final-attempt persistence rule.
⏳ What is Left
1. Database Seeding & Setup
  - PostgreSQL is configured and reachable.
  - `prisma/seed.ts` now imports popular AniList anime and their characters. The current database has 100 anime and 1,000 characters.
  - `scripts/generate-daily.ts` now creates current-day UTC challenges, and daily selection only chooses anime that have the media required by that mode. Missing or invalid challenges now self-heal on the first game request; small media catalogs repeat when necessary instead of showing a no-challenge error.
  - Character daily selection now randomizes the character within the selected anime, rather than always choosing its first record.
  - Opening mode is now a public "Coming soon" experience. Its audio API is disabled by default until a rights-cleared catalog exists.
  - Anidle, Character, and Screenshot now have unlimited Practice Mode at their `/practice` routes, backed by short-lived server-side sessions. Practice does not alter daily scores or streaks.
  - Email/password login and registration pages are implemented and connect to the existing NextAuth credentials provider.
  - Community leaderboard and public player profile pages are implemented using saved daily scores and streaks.
  - Screenshot and Opening still need a curated, licensed media catalog. Copy `prisma/content-catalog.example.json` to the ignored `prisma/content-catalog.json`, add controlled CDN/storage URLs, then rerun `npm.cmd run db:seed` and `npm.cmd run daily:generate`.
2. Frontend UI Components (src/components/)
  - Base UI components (Buttons, Dialogs, Cards, Inputs, Tabs, Tooltips, Badges).
  - Layout components: Navbar, Footer, ModeSelector, and Theme toggle.
  - Shared game widgets:      
    - AnimeSearch (fuzzy autocomplete dropdown).
    - ResultModal (win/loss modal with confetti and score breakdown).
    - ShareCard (visual card + one-click clipboard copy).
    - CountdownTimer (time remaining until next daily challenge).
    - StreakBadge (flame count & freeze indicator).
  - Game-specific components:      
    - Anidle: AnidleGame, GuessRow, AttributeCell, AttributeLegend.
    - Screenshot: Result/share enhancements.
    - Character: Result/share enhancements.
    - Opening: Result/share enhancements.
3. Pages & Routes (src/app/)
  - Daily game pages: /anidle, /screenshot, /character, /opening.
  - Practice / Unlimited mode pages: /anidle/practice, /screenshot/practice, /character/practice, /opening/practice.
  - Auth pages: /login, /register.
  - Community pages: /leaderboard, /profile/[userId].
  - Updated Landing page: / (home dashboard with daily challenge status pills, countdown, streak overview).
4. Verification & Polish
  - `npm.cmd run build` passes with all current routes.
  - README includes setup, seeding, daily generation, and curated-media instructions.
