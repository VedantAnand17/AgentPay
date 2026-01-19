/**
 * Production-safe logger utility
 * Only logs in development environment to prevent exposing internal state in production
 */

const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = {
    /**
     * Log debug information - only in development
     */
    log: (...args: unknown[]): void => {
        if (isDevelopment) {
            console.log(...args);
        }
    },

    /**
     * Log warnings - only in development
     */
    warn: (...args: unknown[]): void => {
        if (isDevelopment) {
            console.warn(...args);
        }
    },

    /**
     * Log errors - always log but sanitize in production
     * In production, only logs generic error identifier, not full message
     */
    error: (message: string, error?: unknown): void => {
        if (isDevelopment) {
            console.error(message, error);
        } else {
            // In production, log a sanitized version
            // The full error should be sent to a proper logging service
            console.error(`[Error] ${message.substring(0, 50)}...`);
        }
    },

    /**
     * Log performance timing - only in development
     */
    time: (label: string): void => {
        if (isDevelopment) {
            console.time(label);
        }
    },

    timeEnd: (label: string): void => {
        if (isDevelopment) {
            console.timeEnd(label);
        }
    },
};

export default logger;
