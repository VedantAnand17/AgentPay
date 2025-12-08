# AgentPay Relay

Execute AI-powered perp trades with one-time x402 payments. No API keys. No custody.

## Overview

AgentPay Relay is a full-stack Web3 application that enables users to execute leveraged perpetual trades on Base Sepolia using a one-time x402 payment instead of providing API keys or custody.

### Flow

1. User configures a trade (agent, symbol, side, size, leverage)
2. Backend creates a TradeIntent + x402 Payment Request
3. Frontend triggers a real x402 payment (via SDK/HTTP, NOT on-chain contract calls)
4. Backend verifies the x402 payment via x402's API/SDK
5. Backend opens a perp position on Base Sepolia using an execution wallet
6. Backend returns the perp tx hash + execution info
7. UI shows a full execution receipt

## Tech Stack

- **Runtime**: Bun
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Web3**: viem for Base Sepolia interaction
- **Database**: SQLite (better-sqlite3) for MVP
- **Payment**: x402 integrated as HTTP/SDK client (not a contract)

## Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```env
# Base Sepolia Network
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
PERP_CONTRACT_ADDRESS=0x...  # Your perp contract address on Base Sepolia
EXECUTION_PRIVATE_KEY=0x...  # Private key of execution wallet (must have funds for gas)

# x402 Integration
X402_API_KEY=your_x402_api_key
X402_BASE_URL=https://api.x402.com/v1

# Database (optional)
DATABASE_PATH=./agentpay.db

# Frontend (optional)
NEXT_PUBLIC_CHAIN_ID=84532  # Base Sepolia chain ID
```

## Installation

1. Install dependencies using Bun:

```bash
bun install
```

2. Set up environment variables (see above)

3. Run the development server:

```bash
bun run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
AgentPay/
├── app/
│   ├── api/
│   │   ├── agents/
│   │   │   ├── route.ts          # GET /api/agents
│   │   │   └── suggest/
│   │   │       └── route.ts      # POST /api/agents/suggest
│   │   └── trades/
│   │       ├── route.ts          # GET /api/trades
│   │       ├── create-intent/
│   │       │   └── route.ts      # POST /api/trades/create-intent
│   │       └── execute/
│   │           └── route.ts      # POST /api/trades/execute
│   ├── trade/
│   │   └── page.tsx              # Trade console UI
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Landing page
│   └── globals.css               # Global styles
├── lib/
│   ├── agents.ts                 # Trading agent strategies
│   ├── db.ts                     # SQLite database operations
│   ├── perp.ts                   # Base Sepolia perp contract interaction
│   ├── types.ts                  # TypeScript type definitions
│   └── x402.ts                   # x402 payment integration
├── package.json
├── tsconfig.json
└── README.md
```

## Core Modules

### Trading Agents (`lib/agents.ts`)

Implements three rule-based trading strategies:

- **Trend Follower**: Follows momentum and trends in the market
- **Breakout Sniper**: Captures breakouts from consolidation patterns
- **Mean Reversion**: Trades against extremes, betting on price returning to average

Each agent returns a deterministic suggestion with:
- `symbol`: Trading pair (BTC, ETH, SOL)
- `side`: "long" or "short"
- `size`: Between 0.01–0.05
- `leverage`: Between 2–5
- `reason`: Explanation of the suggestion

### x402 Integration (`lib/x402.ts`)

Handles payment requests via x402's HTTP API (not on-chain):

- `createX402PaymentRequest()`: Creates a one-time payment request for a trade
- `verifyX402Payment()`: Checks payment status via x402 API

**Note**: The current implementation includes mock functions. Replace with actual x402 API calls in production:
- POST to `{X402_BASE_URL}/payment-requests` to create requests
- GET from `{X402_BASE_URL}/payment-requests/{id}` to verify status

### Perp Contract (`lib/perp.ts`)

Interacts with a simplified perp contract on Base Sepolia:

- `openPerpPositionOnBaseSepolia()`: Opens a leveraged position using the execution wallet

**Note**: The contract ABI is simplified for MVP. Replace `PERP_ABI` with the actual contract ABI when deploying:
- Contract should expose `openPosition(address user, string symbol, bool isLong, uint256 size, uint256 leverage)`
- Ensure `EXECUTION_PRIVATE_KEY` wallet has sufficient funds for gas

### Database (`lib/db.ts`)

SQLite database with two main tables:

- `trade_intents`: Stores pending/paid/executed trade intents
- `executed_trades`: Stores completed trades with tx hashes and entry prices

## API Routes

### GET `/api/agents`

Returns list of available trading agents.

### POST `/api/agents/suggest`

Body: `{ agentId, symbol }`

Returns agent suggestion with side, size, leverage, and reason.

### POST `/api/trades/create-intent`

Body: `{ userAddress, agentId, symbol, side, size, leverage }`

Creates a trade intent and x402 payment request. Returns:
- `tradeIntent`: Created intent with payment request ID
- `paymentRequest`: x402 payment details

### POST `/api/trades/execute`

Body: `{ tradeIntentId }`

Verifies payment, opens perp position, and creates executed trade record. Returns:
- `executedTrade`: Trade execution details with tx hash
- `tradeIntent`: Updated intent

### GET `/api/trades`

Returns list of recent executed trades (limit: 50 by default).

## Frontend Pages

### `/` (Landing Page)

Simple landing page with title, description, and link to trade console.

### `/trade` (Trade Console)

Main trading interface with:

- **Left Panel**: Trade configuration form
  - Wallet address input
  - Agent selection
  - Symbol selection (BTC, ETH, SOL)
  - Side toggle (Long/Short)
  - Size and leverage inputs
  - "Get Agent Suggestion" button
  - "Create Payment Request" button
  - "Mark Payment Complete & Execute" button

- **Right Panel**: Recent executions table
  - Shows symbol, side, size, leverage, payment status, tx hash, and timestamp

## Payment → Verification → Execution Pipeline

1. **Create Intent**: User fills trade form and clicks "Create Payment Request"
   - Backend creates `TradeIntent` with status "pending"
   - Backend calls `createX402PaymentRequest()` to get payment request ID
   - Frontend displays payment amount and request ID

2. **Complete Payment**: User completes payment via x402 UI/SDK
   - In production, user would be redirected to x402 payment page
   - For MVP, user clicks "Mark Payment Complete & Execute" after completing payment

3. **Verify & Execute**: User clicks "Mark Payment Complete & Execute"
   - Backend calls `verifyX402Payment()` to check payment status
   - If paid, backend calls `openPerpPositionOnBaseSepolia()` to execute trade
   - Backend creates `ExecutedTrade` record with tx hash and entry price
   - Frontend displays execution receipt

## Development Notes

- The x402 integration uses mock implementations. Replace with real API calls in `lib/x402.ts`
- The perp contract ABI is simplified. Replace with actual contract ABI in `lib/perp.ts`
- Database file (`agentpay.db`) is created automatically on first run
- All agent strategies use mock price data. In production, integrate with real market data APIs

## License

MIT

