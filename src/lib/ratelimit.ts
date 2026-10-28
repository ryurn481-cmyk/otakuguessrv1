import { Ratelimit } from '@upstash/ratelimit';
import { redis } from './redis';

// Rate limiter for game submission routes
// 10 requests per minute per IP
let submissionRatelimit: Ratelimit | null = null;
let searchRatelimit: Ratelimit | null = null;

if (redis) {
  submissionRatelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '1 m'),
    analytics: true,
    prefix: 'rl:submit',
  });

  searchRatelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, '1 m'),
    analytics: false,
    prefix: 'rl:search',
  });
}

export { submissionRatelimit, searchRatelimit };

/**
 * Get the client IP from request headers (works behind Vercel's CDN).
 */
export function getClientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    '127.0.0.1'
  );
}

