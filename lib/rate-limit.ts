/**
 * Rate Limiting Middleware
 * 
 * Simple in-memory rate limiting for API routes.
 * For production, consider using Redis or Upstash.
 */

import { NextRequest, NextResponse } from "next/server";

// Rate limit configuration
interface RateLimitConfig {
    // Maximum number of requests
    limit: number;
    // Time window in milliseconds
    windowMs: number;
}

// Default rate limit profiles
export const RATE_LIMIT_PROFILES = {
    // Standard API endpoint (60 requests per minute)
    standard: { limit: 60, windowMs: 60 * 1000 },
    // Strict limit for expensive operations (10 per minute)
    strict: { limit: 10, windowMs: 60 * 1000 },
    // Lenient limit for read operations (120 per minute)
    lenient: { limit: 120, windowMs: 60 * 1000 },
    // Very strict for payment operations (5 per minute)
    payment: { limit: 5, windowMs: 60 * 1000 },
} as const;

export type RateLimitProfile = keyof typeof RATE_LIMIT_PROFILES;

// In-memory store for rate limiting
// Key: IP address or identifier, Value: { count, resetTime }
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Clean up expired entries periodically
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
let lastCleanup = Date.now();

function cleanupExpiredEntries() {
    const now = Date.now();
    if (now - lastCleanup < CLEANUP_INTERVAL) return;

    lastCleanup = now;
    for (const [key, value] of rateLimitStore.entries()) {
        if (value.resetTime < now) {
            rateLimitStore.delete(key);
        }
    }
}

/**
 * Get client identifier from request
 * Uses IP address or falls back to a header
 */
function getClientIdentifier(request: NextRequest): string {
    // Try to get real IP from various headers
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) {
        return forwarded.split(",")[0].trim();
    }

    const realIp = request.headers.get("x-real-ip");
    if (realIp) {
        return realIp;
    }

    // Fallback to a generic identifier
    return "unknown";
}

/**
 * Check rate limit for a request
 * Returns { allowed: boolean, remaining: number, reset: number }
 */
export function checkRateLimit(
    identifier: string,
    config: RateLimitConfig
): { allowed: boolean; remaining: number; reset: number; limit: number } {
    cleanupExpiredEntries();

    const now = Date.now();
    const key = identifier;
    const existing = rateLimitStore.get(key);

    // Check if window has expired
    if (!existing || existing.resetTime < now) {
        // Start new window
        const resetTime = now + config.windowMs;
        rateLimitStore.set(key, { count: 1, resetTime });
        return {
            allowed: true,
            remaining: config.limit - 1,
            reset: resetTime,
            limit: config.limit,
        };
    }

    // Within window, increment count
    existing.count++;
    rateLimitStore.set(key, existing);

    const allowed = existing.count <= config.limit;
    const remaining = Math.max(0, config.limit - existing.count);

    return {
        allowed,
        remaining,
        reset: existing.resetTime,
        limit: config.limit,
    };
}

/**
 * Rate limit middleware response headers
 */
function getRateLimitHeaders(result: ReturnType<typeof checkRateLimit>): HeadersInit {
    return {
        "X-RateLimit-Limit": result.limit.toString(),
        "X-RateLimit-Remaining": result.remaining.toString(),
        "X-RateLimit-Reset": new Date(result.reset).toISOString(),
    };
}

/**
 * Rate limit an API handler
 * Wraps a handler with rate limiting
 */
export function withRateLimit<T extends (...args: any[]) => Promise<NextResponse>>(
    handler: T,
    profile: RateLimitProfile = "standard"
): T {
    return (async (request: NextRequest, ...rest: any[]) => {
        const config = RATE_LIMIT_PROFILES[profile];
        const identifier = getClientIdentifier(request);
        const result = checkRateLimit(`${profile}:${identifier}`, config);

        if (!result.allowed) {
            return NextResponse.json(
                {
                    error: "Too many requests",
                    message: `Rate limit exceeded. Try again in ${Math.ceil((result.reset - Date.now()) / 1000)} seconds.`,
                    retryAfter: Math.ceil((result.reset - Date.now()) / 1000),
                },
                {
                    status: 429,
                    headers: {
                        ...getRateLimitHeaders(result),
                        "Retry-After": Math.ceil((result.reset - Date.now()) / 1000).toString(),
                    },
                }
            );
        }

        // Execute the handler and add rate limit headers to response
        const response = await handler(request, ...rest);

        // Clone response to add headers
        const headers = new Headers(response.headers);
        Object.entries(getRateLimitHeaders(result)).forEach(([key, value]) => {
            headers.set(key, value);
        });

        return new NextResponse(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers,
        });
    }) as T;
}

/**
 * Rate limit check for use in route handlers
 * Returns null if allowed, or a 429 response if rate limited
 */
export function rateLimitCheck(
    request: NextRequest,
    profile: RateLimitProfile = "standard"
): NextResponse | null {
    const config = RATE_LIMIT_PROFILES[profile];
    const identifier = getClientIdentifier(request);
    const result = checkRateLimit(`${profile}:${identifier}`, config);

    if (!result.allowed) {
        return NextResponse.json(
            {
                error: "Too many requests",
                message: `Rate limit exceeded. Try again in ${Math.ceil((result.reset - Date.now()) / 1000)} seconds.`,
                retryAfter: Math.ceil((result.reset - Date.now()) / 1000),
            },
            {
                status: 429,
                headers: {
                    ...getRateLimitHeaders(result),
                    "Retry-After": Math.ceil((result.reset - Date.now()) / 1000).toString(),
                },
            }
        );
    }

    return null;
}
