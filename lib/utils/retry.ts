/**
 * Transaction Retry Utility
 * 
 * Provides retry logic for blockchain transactions with:
 * - Exponential backoff
 * - Configurable retry limits
 * - Error classification
 */

import { logger } from "@/lib/logger";

// Retry configuration
export interface RetryConfig {
    maxRetries: number;
    initialDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
}

// Default retry configuration
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
};

// Errors that should trigger a retry
const RETRYABLE_ERROR_PATTERNS = [
    /nonce too low/i,
    /replacement transaction underpriced/i,
    /transaction underpriced/i,
    /intrinsic gas too low/i,
    /timeout/i,
    /network error/i,
    /connection refused/i,
    /ECONNRESET/i,
    /ETIMEDOUT/i,
    /rate limit/i,
    /too many requests/i,
    /502/i,
    /503/i,
    /504/i,
];

// Errors that should NOT be retried
const NON_RETRYABLE_ERROR_PATTERNS = [
    /insufficient funds/i,
    /insufficient balance/i,
    /execution reverted/i,
    /user rejected/i,
    /user denied/i,
    /invalid signature/i,
    /invalid address/i,
];

/**
 * Determine if an error should trigger a retry
 */
export function isRetryableError(error: unknown): boolean {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Check if it's explicitly non-retryable
    for (const pattern of NON_RETRYABLE_ERROR_PATTERNS) {
        if (pattern.test(errorMessage)) {
            return false;
        }
    }

    // Check if it matches retryable patterns
    for (const pattern of RETRYABLE_ERROR_PATTERNS) {
        if (pattern.test(errorMessage)) {
            return true;
        }
    }

    // Default: don't retry unknown errors
    return false;
}

/**
 * Calculate delay for a given retry attempt
 */
export function calculateDelay(attempt: number, config: RetryConfig): number {
    const delay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt);
    return Math.min(delay, config.maxDelayMs);
}

/**
 * Wait for a specified duration
 */
function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a function with retry logic
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    config: Partial<RetryConfig> = {},
    context: string = "operation"
): Promise<T> {
    const fullConfig: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= fullConfig.maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));

            // Check if we should retry
            if (attempt >= fullConfig.maxRetries) {
                logger.error(`${context}: All ${fullConfig.maxRetries + 1} attempts failed`, {
                    error: lastError.message,
                    attempts: attempt + 1,
                });
                throw lastError;
            }

            if (!isRetryableError(error)) {
                logger.error(`${context}: Non-retryable error encountered`, {
                    error: lastError.message,
                    attempt: attempt + 1,
                });
                throw lastError;
            }

            // Calculate delay and wait
            const delay = calculateDelay(attempt, fullConfig);
            logger.warn(`${context}: Attempt ${attempt + 1} failed, retrying in ${delay}ms`, {
                error: lastError.message,
                nextAttempt: attempt + 2,
                maxAttempts: fullConfig.maxRetries + 1,
            });

            await sleep(delay);
        }
    }

    // This should never be reached, but TypeScript requires it
    throw lastError || new Error(`${context}: Unknown error after retries`);
}

/**
 * Transaction-specific retry wrapper
 */
export async function withTransactionRetry<T>(
    fn: () => Promise<T>,
    config: Partial<RetryConfig> = {}
): Promise<T> {
    return withRetry(fn, {
        maxRetries: 3,
        initialDelayMs: 2000,
        maxDelayMs: 15000,
        backoffMultiplier: 2,
        ...config,
    }, "Transaction");
}

/**
 * RPC call retry wrapper with more aggressive retries
 */
export async function withRpcRetry<T>(
    fn: () => Promise<T>,
    config: Partial<RetryConfig> = {}
): Promise<T> {
    return withRetry(fn, {
        maxRetries: 5,
        initialDelayMs: 500,
        maxDelayMs: 5000,
        backoffMultiplier: 1.5,
        ...config,
    }, "RPC call");
}
