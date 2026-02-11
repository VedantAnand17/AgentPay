# Technical Architecture: AgentPay

## 1. High-Level System Workflow
The system operates as a **State-Gated Relay**. Execution logic is physically separated from intent generation by a cryptographic payment layer.

```mermaid
graph LR
    User((User)) -->|1. Select Agent| UI[Next.js Interface]
    UI -->|2. Generate Intent| API_I[Intent API]
    API_I -->|3. 402 Required| x402{x402 Gateway}
    x402 -->|4. Payment Signature| API_E[Execution Engine]
    API_E -->|5. Autonomous Swap| Uni[Uniswap V3]
    Uni -->|6. Settlement| User
```

---

## 2. Core Service Components

### A. AI Strategy Engine (`lib/agents.ts`)
The engine follows a **Strategy Pattern**. It consumes a unified `AgentContext` and outputs execution parameters based on technical indicators.
*   **Trend Follower:** EMA Crossovers (Short 5 vs Long 10).
*   **Breakout Sniper:** Volume/Volatility triggers on price consolidation range (<2%).
*   **Mean Reversion:** Z-Score analysis (deviation >3% from 15-period mean).

### B. Payment Middleware (`lib/x402-middleware.ts`)
Implements a custom **Next.js Middleware** gatekeeper using the HTTP 402 standard.

```mermaid
sequenceDiagram
    participant C as Client (Wallet)
    participant S as Server (Middleware)
    participant E as Execution Engine

    C->>S: Request Execution (Trade Intent)
    Note over S: Check "PAYMENT-SIGNATURE"
    S-->>C: 402 Payment Required (Auth Header)
    C->>C: Sign Transaction (USDC)
    C->>S: Retry with Signature
    S->>S: Verify Signature via Facilitator
    S->>E: Authorize Trigger
    E->>C: Return Transaction Hash
```

### C. Blockchain Execution Engine (`lib/uniswap-v3.ts`)
A robust wrapper around `viem` handles the complexities of decentralized liquidity.
*   **Autonomous Routing:** Automatically manages ERC20 `approve()` flows before swapping.
*   **RPC Reliability:** Implements an **Active-Passive Fallback** (rotates through 4+ RPC nodes if latency exceeds 10s).
*   **Slippage Guard:** Programmatically queries `QuoterV2` to set `amountOutMinimum` before every transaction.

---

## 3. Data & Persistence Model
The system uses an **Environmental Adapter** to ensure 100% uptime across different hosting providers.

```mermaid
classDiagram
    class Database {
        +createIntent()
        +updateStatus()
        +getExecuted()
    }
    class SQLiteAdapter {
        +better-sqlite3
        +Persistent Storage
    }
    class MemoryAdapter {
        +In-Memory Map
        +Serverless Ready
    }
    Database <|-- SQLiteAdapter : Local Dev
    Database <|-- MemoryAdapter : Vercel Prod
```

---

## 4. Summary of Technical Innovations
1.  **Monetized Autonomy:** AI agents act autonomously but are financially "unlocked" on a per-use basis.
2.  **Stateless Security:** By using x402 signatures, the server doesn't need to hold user private keys to authorize a trade.
3.  **Cross-Network Resilience:** The RPC fallback and Zod-based validation ensure that transactions are finalized even during testnet instability.

---
*This document summarizes the technical framework of the AgentPay research project.*
