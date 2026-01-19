/**
 * Health Check API Endpoint
 * 
 * GET /api/health - Returns service health status
 * 
 * Used for:
 * - Load balancer health checks
 * - Monitoring service availability
 * - Kubernetes liveness/readiness probes
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentNetwork, getCurrentChainId } from "@/lib/config/networks";
import { APP_VERSION } from "@/lib/config/app";

interface HealthStatus {
    status: "healthy" | "degraded" | "unhealthy";
    version: string;
    timestamp: string;
    uptime: number;
    network: {
        name: string;
        chainId: number;
    };
    checks: {
        database: boolean;
        blockchain: boolean;
    };
}

// Track server start time for uptime calculation
const startTime = Date.now();

/**
 * Check database connectivity
 */
async function checkDatabase(): Promise<boolean> {
    try {
        // Import dynamically to avoid build-time issues
        const { default: getDb } = await import("@/lib/db");
        const db = getDb();
        // Simple query to check connectivity
        db.prepare("SELECT 1").get();
        return true;
    } catch (error) {
        console.error("Database health check failed:", error);
        return false;
    }
}

/**
 * Check blockchain connectivity by verifying we can determine network
 */
async function checkBlockchain(): Promise<boolean> {
    try {
        const chainId = getCurrentChainId();
        return chainId > 0;
    } catch (error) {
        console.error("Blockchain health check failed:", error);
        return false;
    }
}

export async function GET(request: NextRequest): Promise<NextResponse<HealthStatus>> {
    // Run health checks
    const [databaseOk, blockchainOk] = await Promise.all([
        checkDatabase(),
        checkBlockchain(),
    ]);

    const allChecksPass = databaseOk && blockchainOk;
    const someChecksFail = !databaseOk || !blockchainOk;

    const status: HealthStatus = {
        status: allChecksPass ? "healthy" : (someChecksFail ? "degraded" : "unhealthy"),
        version: APP_VERSION,
        timestamp: new Date().toISOString(),
        uptime: Math.floor((Date.now() - startTime) / 1000),
        network: {
            name: getCurrentNetwork(),
            chainId: getCurrentChainId(),
        },
        checks: {
            database: databaseOk,
            blockchain: blockchainOk,
        },
    };

    // Return appropriate HTTP status
    const httpStatus = status.status === "healthy" ? 200 : (status.status === "degraded" ? 200 : 503);

    return NextResponse.json(status, { status: httpStatus });
}

// HEAD request for simple uptime checks
export async function HEAD(): Promise<NextResponse> {
    return new NextResponse(null, { status: 200 });
}
