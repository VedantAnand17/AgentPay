/**
 * Agent Configuration
 * 
 * Configurable agent definitions that can be extended.
 * In production, this could be loaded from a database.
 */

import { Agent } from "@/lib/types";

// Agent configuration from environment or defaults
// Format: JSON array of agent definitions
function loadAgentsFromEnv(): Agent[] | null {
    const agentsJson = process.env.AGENTS_CONFIG;
    if (!agentsJson) return null;

    try {
        const parsed = JSON.parse(agentsJson);
        if (Array.isArray(parsed)) {
            return parsed.map((a: any) => ({
                id: a.id,
                name: a.name,
                description: a.description,
            }));
        }
    } catch (e) {
        console.warn("Failed to parse AGENTS_CONFIG environment variable:", e);
    }
    return null;
}

// Default agents (used if no env config provided)
const DEFAULT_AGENTS: Agent[] = [
    {
        id: "trend-follower",
        name: "Trend Follower",
        description: "Follows momentum and trends in the market",
    },
    {
        id: "breakout-sniper",
        name: "Breakout Sniper",
        description: "Captures breakouts from consolidation patterns",
    },
    {
        id: "mean-reversion",
        name: "Mean Reversion",
        description: "Trades against extremes, betting on price returning to average",
    },
];

// Export configured agents (from env or defaults)
export const CONFIGURED_AGENTS: Agent[] = loadAgentsFromEnv() || DEFAULT_AGENTS;

// Get all available agent IDs
export const AGENT_IDS = CONFIGURED_AGENTS.map((a) => a.id);

// Check if an agent ID is valid
export function isValidAgentId(agentId: string): boolean {
    return AGENT_IDS.includes(agentId);
}

// Get agent by ID
export function getAgentConfig(agentId: string): Agent | undefined {
    return CONFIGURED_AGENTS.find((a) => a.id === agentId);
}
