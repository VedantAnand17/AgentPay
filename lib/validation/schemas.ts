/**
 * Zod Validation Schemas
 * 
 * Centralized input validation for all API routes.
 * Uses Zod for runtime type checking and validation.
 */

import { z } from "zod";
import { SUPPORTED_TRADING_SYMBOLS } from "@/lib/config/tokens";

// Ethereum address validation
const ethereumAddressSchema = z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format");

// Trade side validation (Zod 4 compatible)
const tradeSideSchema = z.enum(["buy", "sell"]);

// Trading symbol validation (derived from config)
const tradingSymbolSchema = z
    .string()
    .transform((val) => val.toUpperCase())
    .refine((val) => SUPPORTED_TRADING_SYMBOLS.includes(val), {
        message: `Symbol must be one of: ${SUPPORTED_TRADING_SYMBOLS.join(", ")}`,
    });

// Positive number validation
const positiveNumberSchema = z
    .number()
    .positive("Value must be positive");

// Trade intent creation schema
export const createTradeIntentSchema = z.object({
    userAddress: ethereumAddressSchema,
    agentId: z.string().min(1, "Agent ID is required"),
    symbol: tradingSymbolSchema,
    side: tradeSideSchema,
    size: z
        .union([z.string(), z.number()])
        .transform((val) => (typeof val === "string" ? parseFloat(val) : val))
        .refine((val) => val > 0, { message: "Size must be positive" }),
    // Leverage is accepted for API compatibility but always coerced to 1.
    // This platform only supports spot trading — no leveraged positions.
    leverage: z
        .union([z.string(), z.number()])
        .optional()
        .transform(() => 1),
});

export type CreateTradeIntentInput = z.infer<typeof createTradeIntentSchema>;

// Trade execution schema
export const executeTradeSchema = z.object({
    tradeIntentId: z.string().min(1, "Trade intent ID is required"),
});

export type ExecuteTradeInput = z.infer<typeof executeTradeSchema>;

// Agent suggestion schema
export const agentSuggestSchema = z.object({
    agentId: z.string().min(1, "Agent ID is required"),
    symbol: tradingSymbolSchema,
});

export type AgentSuggestInput = z.infer<typeof agentSuggestSchema>;

// Balance check schema
export const balanceCheckSchema = z.object({
    address: ethereumAddressSchema,
    symbol: z.string().min(1, "Symbol is required").transform((val) => val.toUpperCase()),
});

export type BalanceCheckInput = z.infer<typeof balanceCheckSchema>;

// Pool check schema
export const poolCheckSchema = z.object({
    tokenA: z.string().min(1, "Token A is required"),
    tokenB: z.string().min(1, "Token B is required"),
    fee: z
        .union([z.string(), z.number()])
        .optional()
        .transform((val) => {
            if (val === undefined) return 3000;
            return typeof val === "string" ? parseInt(val, 10) : val;
        }),
});

export type PoolCheckInput = z.infer<typeof poolCheckSchema>;

/**
 * Validate request body against a schema
 * Returns either the validated data or an error response
 */
export function validateRequest<T>(
    schema: z.ZodSchema<T>,
    data: unknown
): { success: true; data: T } | { success: false; error: string; details?: z.ZodError["issues"] } {
    const result = schema.safeParse(data);

    if (result.success) {
        return { success: true, data: result.data };
    }

    // Format error message
    const errorMessages = result.error.issues.map((issue) => {
        const path = issue.path.join(".");
        return path ? `${path}: ${issue.message}` : issue.message;
    });

    return {
        success: false,
        error: errorMessages.join("; "),
        details: result.error.issues,
    };
}

/**
 * Async request body parser with validation
 * Throws a formatted error if validation fails
 */
export async function parseAndValidate<T>(
    request: Request,
    schema: z.ZodSchema<T>
): Promise<T> {
    const body = await request.json();
    const result = validateRequest(schema, body);

    if (!result.success) {
        const error = new Error(result.error);
        (error as any).statusCode = 400;
        (error as any).validationErrors = result.details;
        throw error;
    }

    return result.data;
}
