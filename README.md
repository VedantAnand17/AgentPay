# AgentPay Relay

Execute AI-powered perp trades with one-time x402 payments. No API keys. No custody.

## Overview

AgentPay Relay is a full-stack Web3 application that enables users to execute leveraged perpetual trades on Base Sepolia using a one-time x402 payment instead of providing API keys or custody.

### Flow

1. User configures a trade (agent, symbol, side, size, leverage) and connects wallet
2. Backend creates a TradeIntent with payment configuration
3. User clicks "Execute Trade" - frontend uses x402 client library
4. x402 client automatically handles payment via wallet (shows payment confirmation UI)
5. Backend uses x402 middleware to verify payment before executing
6. Backend opens a perp position on Base Sepolia using an execution wallet
7. Backend returns the perp tx hash + execution info
8. UI shows a full execution receipt

## Tech Stack

- **Runtime**: Bun
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Web3**: viem for Base Sepolia interaction
- **Database**: SQLite (better-sqlite3) for MVP
- **Payment**: x402 integrated using `x402-fetch` (frontend) and `x402-express` middleware pattern (backend, adapted for Next.js)

## Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```env
# Base Sepolia Network
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
PERP_CONTRACT_ADDRESS=0x...  # Your perp contract address on Base Sepolia
EXECUTION_PRIVATE_KEY=0x...  # Private key of execution wallet (must have funds for gas)

# x402 Integration (no API keys needed - wallet-based)
# You can use either X402_PAYMENT_ADDRESS or ADDRESS (x402-Learn pattern)
X402_PAYMENT_ADDRESS=0x...  # Address to receive payments (or use ADDRESS)
ADDRESS=0x...  # Alternative: wallet address to receive payments
X402_ASSET_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913  # USDC on Base
X402_NETWORK=base-sepolia  # Network for payments (base-sepolia or base)
X402_ENV=testnet  # Set to "mainnet" to use Coinbase facilitator on mainnet
FACILITATOR_URL=https://x402.org/facilitator  # Optional: custom facilitator URL

# WalletConnect (for Web3Modal wallet connection)
# Get your project ID from https://cloud.walletconnect.com
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your-project-id-here

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
│   ├── x402.ts                   # x402 payment configuration
│   └── x402-middleware.ts        # x402 middleware for Next.js API routes
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

### x402 Integration (`lib/x402.ts` and `lib/x402-middleware.ts`)

x402 integration uses wallet-based payments (no API keys required), based on the x402-Learn integration pattern:

- **Frontend**: Uses `x402-fetch` library
  - User connects wallet
  - `x402Fetch()` automatically handles payments via wallet UI when making requests
  - Detects 402 Payment Required responses and shows payment confirmation UI
  - Payment is handled seamlessly in the background

- **Backend**: Uses x402 middleware pattern (adapted for Next.js)
  - `x402PaymentRequired()` middleware wraps API routes
  - Payment is verified automatically before handler executes
  - If payment not verified, returns 402 Payment Required with payment details
  - Based on `x402-express` middleware pattern, adapted for Next.js Request/Response

**Implementation Details**:
- Uses `@coinbase/x402` for facilitator configuration
- Supports both testnet (base-sepolia) and mainnet (base) via `X402_ENV` environment variable
- Payment configuration matches x402-Learn pattern with price, network, and metadata
- x402 shows wallet confirmation UI automatically when payment is required

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
   - Frontend displays payment amount and trade details

2. **Connect Wallet**: User connects their wallet
   - Frontend uses wallet connector (e.g., wagmi, web3modal)
   - `x402Client.setWallet(wallet)` configures x402 client

3. **Execute Trade**: User clicks "Execute Trade"
   - Frontend uses `x402Client.fetch("/api/trades/execute", ...)`
   - x402 client automatically detects payment requirement
   - Wallet UI shows payment confirmation (amount, token, resource)
   - User approves payment in wallet

4. **Verify & Execute**: Backend receives request
   - x402 middleware verifies payment from request headers
   - If payment verified, handler executes:
     - Calls `openPerpPositionOnBaseSepolia()` to execute trade
     - Creates `ExecutedTrade` record with tx hash and entry price
   - If payment not verified, returns 402 Payment Required

5. **Display Result**: Frontend receives execution result
   - Shows execution receipt with tx hash, entry price, etc.
   - Refreshes recent trades list

## Development Notes

- **x402 Integration**: 
  - Frontend: Uses `x402-fetch` for automatic payment handling (integrated from x402-Learn)
  - Backend: Uses `x402-express` middleware pattern, adapted for Next.js API routes
  - No API keys needed - x402 uses wallet-based payments
  - Supports both testnet and mainnet via `X402_ENV` environment variable
  - Integration follows the same pattern as x402-Learn project

- **Wallet Integration**: 
  - Currently uses a mock wallet connector
  - In production, integrate with wagmi, web3modal, or your preferred wallet connector
  - x402 works with any wallet that supports standard signing methods

- **Perp Contract**: 
  - The contract ABI is simplified. Replace with actual contract ABI in `lib/perp.ts`
  - Ensure `EXECUTION_PRIVATE_KEY` wallet has sufficient funds for gas

- **Database**: 
  - Database file (`agentpay.db`) is created automatically on first run

- **Agent Strategies**: 
  - All agent strategies use mock price data. In production, integrate with real market data APIs

## License

MIT

