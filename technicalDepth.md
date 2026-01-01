# AgentPay Relay - Technical Deep Dive

## Executive Summary

AgentPay Relay is a sophisticated Web3 application that enables AI agents and users to execute spot trades on Uniswap V3/V4 using one-time x402 payments. The system eliminates the need for API keys, custody, or traditional authentication by leveraging wallet-based payments and smart contract interactions.

**Core Innovation**: Pay-per-trade model using x402 protocol, where payment verification happens atomically with trade execution.

---

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Next.js)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Trade UI    │  │  Web3Modal   │  │  x402-fetch  │      │
│  │  (React)     │  │  (Wagmi)     │  │  (Payment)   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  Backend (Next.js API Routes)                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ x402         │  │  Agent       │  │  Uniswap     │      │
│  │ Middleware   │  │  Strategies  │  │  Integration │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    Infrastructure Layer                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  SQLite DB   │  │  Base        │  │  Uniswap V3  │      │
│  │  (Trades)    │  │  Sepolia     │  │  Pools       │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

---

## Core Technologies

### Runtime & Framework
- **Bun**: JavaScript runtime (faster than Node.js)
- **Next.js 14**: React framework with App Router
- **TypeScript**: Type-safe development

### Web3 Stack
- **viem**: Ethereum interaction library (modern alternative to ethers.js)
- **wagmi**: React hooks for Ethereum
- **Web3Modal**: Multi-wallet connection UI
- **Base Sepolia**: L2 testnet for development

### Payment Protocol
- **x402**: HTTP 402 Payment Required protocol
- **@coinbase/x402**: Facilitator integration
- **x402-fetch**: Client-side payment handling
- **x402-express**: Server-side payment verification (adapted for Next.js)

### Database & Storage
- **better-sqlite3**: Embedded SQL database
- **SQLite**: Zero-configuration database

### Smart Contracts
- **Foundry**: Solidity development framework
- **Uniswap V3**: DEX protocol for token swaps
- **OpenZeppelin**: ERC20 token standards

---

## Deep Dive: Core Modules

### 1. Trading Agents (`lib/agents.ts`)

**Purpose**: Implements rule-based trading strategies that provide deterministic trade suggestions.

#### Agent Types

##### a) Trend Follower
```typescript
Algorithm:
1. Fetch 10 historical price points
2. Calculate recent average (last 5) vs older average (first 5)
3. Compute trend strength: (recentAvg - olderAvg) / olderAvg
4. Decision:
   - If trend > 1%: BUY
   - If trend < -1%: SELL
   - Otherwise: Default BUY
```

**Key Features**:
- Momentum-based strategy
- Uses moving average crossover
- Dynamic position sizing based on trend strength

##### b) Breakout Sniper
```typescript
Algorithm:
1. Analyze 20 price points
2. Calculate range: high - low
3. Detect consolidation: range/avgPrice < 2%
4. Determine position in range
5. Decision:
   - Near upper bound + consolidating: BUY (expect breakout)
   - Near lower bound + consolidating: SELL (expect breakdown)
   - Already breaking out: Follow momentum
```

**Key Features**:
- Pattern recognition (consolidation)
- Anticipates volatility expansion
- Position-aware entry logic

##### c) Mean Reversion
```typescript
Algorithm:
1. Calculate historical mean (10 periods)
2. Compare current price to mean
3. Compute deviation percentage
4. Decision:
   - Price > 3% above mean: SELL (overbought)
   - Price > 3% below mean: BUY (oversold)
   - Otherwise: Default BUY
```

**Key Features**:
- Statistical arbitrage approach
- Assumes price returns to equilibrium
- Deviation-based position sizing

#### Mock Price Generation
```typescript
// Deterministic price generation for demo
const getMockPrice = (symbol: string): number => {
  const seed = symbol.charCodeAt(0) + symbol.charCodeAt(1) + symbol.charCodeAt(2);
  const base = 30000 + (seed % 10000);
  const variation = Math.sin(Date.now() / 100000) * 1000;
  return base + variation;
};
```

**Production Considerations**:
- Replace with real market data APIs (CoinGecko, Binance, etc.)
- Implement WebSocket connections for real-time data
- Add data validation and error handling
- Consider rate limiting and caching

---

### 2. x402 Payment Integration

The x402 protocol enables HTTP-based micropayments using the `402 Payment Required` status code.

#### Architecture

```
Client Request → 402 Response → Payment → Verified Request → Execute
```

#### Frontend (`lib/x402.ts`)

**Configuration**:
```typescript
{
  price: "$5.00",              // Payment amount
  network: "base-sepolia",     // Blockchain network
  address: "0x...",            // Payment recipient
  config: {
    description: "Execute buy trade for BTC",
    metadata: {
      tradeIntentId: "...",
      userAddress: "...",
      symbol: "BTC",
      side: "buy",
      size: 0.05
    }
  }
}
```

**Payment Flow**:
1. User initiates trade execution
2. `x402Fetch()` makes request to `/api/trades/execute`
3. Server returns 402 with payment requirements
4. x402 client shows wallet confirmation UI
5. User approves payment in wallet
6. Request retried with payment proof
7. Server verifies and executes trade

#### Backend (`lib/x402-middleware.ts`)

**Middleware Pattern**:
```typescript
export function x402PaymentRequired(
  config: PaymentConfig,
  handler: (req, paymentInfo) => Promise<Response>
) {
  return async (request: NextRequest) => {
    // 1. Build payment requirements
    const requirements = buildPaymentRequirements(config);
    
    // 2. Verify payment from headers
    const verification = await verifyX402Payment(request, requirements);
    
    if (!verification.isValid) {
      // 3. Return 402 Payment Required
      return createPaymentRequiredResponse(config);
    }
    
    // 4. Execute handler with payment info
    const response = await handler(request, verification.paymentInfo);
    
    // 5. Settle payment with facilitator
    await settleFacilitatorPayment(verification);
    
    return response;
  };
}
```

**Payment Verification**:
```typescript
async function verifyX402Payment(request, requirements) {
  // Extract payment headers
  const paymentHeader = request.headers.get("x-payment");
  const paymentPayload = JSON.parse(paymentHeader);
  
  // Verify with facilitator
  const verifyResponse = await useFacilitator(facilitatorConfig).verify({
    payment: paymentPayload,
    requirements: requirements
  });
  
  return {
    isValid: verifyResponse.verified,
    paymentInfo: paymentPayload,
    verifyResponse
  };
}
```

**Key Security Features**:
- Cryptographic payment verification via facilitator
- Atomic payment-execution coupling
- No pre-funding or custody required
- Replay attack prevention

---

### 3. Uniswap V3 Integration (`lib/uniswap.ts`)

**Purpose**: Execute spot token swaps on Uniswap V3 pools.

#### Pool Configuration

```typescript
Pool Details (Base Sepolia):
- Factory: 0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24
- SwapRouter02: 0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4
- Currency0: USDC (0xB6c34A382a45F93682B03dCa9C48e3710e76809F)
- Currency1: cbBTC (0xb9B962177c15353cd6AA49E26c2b627b9CC35457)
- Fee Tier: 0.3% (3000)
- Tick Spacing: 60
```

#### Swap Execution Flow

```typescript
async function executeUniswapV3Swap({
  userAddress,
  symbol,
  side,
  size
}) {
  // 1. Setup clients
  const walletClient = createWalletClient({
    account: privateKeyToAccount(EXECUTION_PRIVATE_KEY),
    chain: baseSepolia,
    transport: http(RPC_URL)
  });
  
  // 2. Determine swap direction
  const tokenIn = side === "buy" ? USDC : TOKEN_ADDRESSES[symbol];
  const tokenOut = side === "buy" ? TOKEN_ADDRESSES[symbol] : USDC;
  
  // 3. Calculate amounts
  const amountIn = parseUnits(size.toString(), tokenIn.decimals);
  
  // 4. Approve token spending
  await walletClient.writeContract({
    address: tokenIn.address,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [SWAP_ROUTER_ADDRESS, amountIn]
  });
  
  // 5. Execute swap
  const txHash = await walletClient.writeContract({
    address: SWAP_ROUTER_ADDRESS,
    abi: SWAP_ROUTER_ABI,
    functionName: "exactInputSingle",
    args: [{
      tokenIn: tokenIn.address,
      tokenOut: tokenOut.address,
      fee: 3000,
      recipient: userAddress,
      deadline: BigInt(Math.floor(Date.now() / 1000) + 300),
      amountIn: amountIn,
      amountOutMinimum: calculateMinOutput(amountIn),
      sqrtPriceLimitX96: 0n
    }]
  });
  
  // 6. Wait for confirmation
  await publicClient.waitForTransactionReceipt({ hash: txHash });
  
  return { txHash, executionPrice };
}
```

#### Slippage Protection

```typescript
// 15% slippage tolerance for testnet (low liquidity)
const SLIPPAGE_TOLERANCE = 0.15;

function calculateMinOutput(amountIn: bigint): bigint {
  const expectedOut = quoteSwap(amountIn); // Get quote from pool
  return expectedOut * (1n - BigInt(SLIPPAGE_TOLERANCE * 100)) / 100n;
}
```

**Production Considerations**:
- Reduce slippage tolerance (0.5-1% for mainnet)
- Implement price oracle integration
- Add MEV protection (Flashbots, private RPC)
- Multi-hop routing for better prices
- Gas optimization strategies

---

### 4. Database Layer (`lib/db.ts`)

**Schema Design**:

```sql
-- Trade Intents: Pending payment requests
CREATE TABLE trade_intents (
  id TEXT PRIMARY KEY,
  userAddress TEXT NOT NULL,
  agentId TEXT NOT NULL,
  symbol TEXT NOT NULL,
  side TEXT CHECK(side IN ('buy', 'sell')),
  size REAL NOT NULL,
  leverage INTEGER NOT NULL,
  expectedPaymentAmount TEXT NOT NULL,
  status TEXT CHECK(status IN ('pending', 'paid', 'executed')),
  paymentRequestId TEXT,
  createdAt INTEGER NOT NULL
);

-- Executed Trades: Completed swaps
CREATE TABLE executed_trades (
  id TEXT PRIMARY KEY,
  tradeIntentId TEXT NOT NULL,
  paymentRequestId TEXT,
  paymentStatus TEXT CHECK(paymentStatus IN ('paid', 'failed')),
  swapTxHash TEXT NOT NULL,
  executionPrice REAL NOT NULL,
  timestamp INTEGER NOT NULL,
  status TEXT DEFAULT 'executed',
  FOREIGN KEY (tradeIntentId) REFERENCES trade_intents(id)
);
```

**Operations**:

```typescript
// Create trade intent
tradeIntents.create({
  id: "intent_123",
  userAddress: "0x...",
  agentId: "trend-follower",
  symbol: "BTC",
  side: "buy",
  size: 0.05,
  leverage: 1,
  expectedPaymentAmount: "5.00",
  status: "pending",
  createdAt: Date.now()
});

// Update status after payment
tradeIntents.updateStatus("intent_123", "paid", "payment_456");

// Record execution
executedTrades.create({
  id: "trade_789",
  tradeIntentId: "intent_123",
  paymentRequestId: "payment_456",
  paymentStatus: "paid",
  swapTxHash: "0xabc...",
  executionPrice: 42000.50,
  timestamp: Date.now(),
  status: "executed"
});
```

**Indexing Strategy**:
```sql
CREATE INDEX idx_trade_intents_user ON trade_intents(userAddress);
CREATE INDEX idx_trade_intents_status ON trade_intents(status);
CREATE INDEX idx_executed_trades_timestamp ON executed_trades(timestamp DESC);
```

---

## API Routes

### 1. GET `/api/agents`

**Purpose**: List available trading agents

**Response**:
```json
[
  {
    "id": "trend-follower",
    "name": "Trend Follower",
    "description": "Follows momentum and trends in the market"
  },
  {
    "id": "breakout-sniper",
    "name": "Breakout Sniper",
    "description": "Captures breakouts from consolidation patterns"
  },
  {
    "id": "mean-reversion",
    "name": "Mean Reversion",
    "description": "Trades against extremes"
  }
]
```

### 2. POST `/api/agents/suggest`

**Purpose**: Get trade suggestion from agent

**Request**:
```json
{
  "agentId": "trend-follower",
  "symbol": "BTC"
}
```

**Response**:
```json
{
  "symbol": "BTC",
  "side": "buy",
  "size": 0.03,
  "leverage": 1,
  "reason": "Strong uptrend detected (2.45% momentum). Following the trend."
}
```

### 3. POST `/api/trades/create-intent`

**Purpose**: Create payment request for trade

**Request**:
```json
{
  "userAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "agentId": "trend-follower",
  "symbol": "BTC",
  "side": "buy",
  "size": 0.03,
  "leverage": 1
}
```

**Response**:
```json
{
  "tradeIntent": {
    "id": "intent_1735756800_a3f2",
    "userAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "agentId": "trend-follower",
    "symbol": "BTC",
    "side": "buy",
    "size": 0.03,
    "leverage": 1,
    "expectedPaymentAmount": "5.00",
    "status": "pending",
    "paymentRequestId": "x402_1735756800_k9m2p",
    "createdAt": 1735756800000
  },
  "paymentRequest": {
    "paymentRequestId": "x402_1735756800_k9m2p",
    "amount": "5.00",
    "currency": "USD",
    "metadata": {
      "tradeIntentId": "intent_1735756800_a3f2",
      "userAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      "symbol": "BTC",
      "side": "buy",
      "size": 0.03
    }
  }
}
```

### 4. POST `/api/trades/execute`

**Purpose**: Execute trade after payment verification

**Request**:
```json
{
  "tradeIntentId": "intent_1735756800_a3f2"
}
```

**Headers** (added by x402-fetch):
```
x-payment: {"id": "payment_456", "amount": "5.00", ...}
x-payment-signature: "0x..."
```

**Response**:
```json
{
  "executedTrade": {
    "id": "trade_1735756850_b7k3",
    "tradeIntentId": "intent_1735756800_a3f2",
    "paymentRequestId": "payment_456",
    "paymentStatus": "paid",
    "swapTxHash": "0xabc123...",
    "executionPrice": 42150.75,
    "timestamp": 1735756850000,
    "status": "executed"
  },
  "tradeIntent": {
    "id": "intent_1735756800_a3f2",
    "status": "executed",
    ...
  }
}
```

**Error Responses**:
```json
// 402 Payment Required
{
  "error": "Payment required",
  "paymentRequirements": {
    "price": "$5.00",
    "network": "base-sepolia",
    "address": "0x...",
    "metadata": {...}
  }
}

// 404 Not Found
{
  "error": "Trade intent not found"
}

// 500 Internal Server Error
{
  "error": "Failed to execute swap: insufficient liquidity"
}
```

### 5. GET `/api/balances`

**Purpose**: Check token balance

**Query Parameters**:
- `address`: Wallet address
- `symbol`: Token symbol (BTC, USDC, etc.)

**Response**:
```json
{
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "symbol": "BTC",
  "balance": "100000000",
  "formatted": "1.0"
}
```

---

## Frontend Architecture

### Wallet Integration (`app/providers.tsx`)

**Stack**:
- **wagmi**: React hooks for Ethereum
- **Web3Modal**: Multi-wallet UI
- **TanStack Query**: Data fetching and caching

**Configuration**:
```typescript
const wagmiConfig = createConfig({
  chains: [baseSepolia],
  connectors: [
    walletConnect({ projectId }),
    injected({ shimDisconnect: true }),
    coinbaseWallet({ appName: "AgentPay Relay" })
  ],
  transports: {
    [baseSepolia.id]: http()
  },
  ssr: false // Avoid indexedDB errors
});
```

**Wallet Connection Flow**:
```typescript
// 1. User clicks "Connect Wallet"
const { open } = useWeb3Modal();
await open();

// 2. User selects wallet (MetaMask, Coinbase, WalletConnect)
// 3. Wallet prompts for connection approval
// 4. Connection established

const { address, isConnected } = useAccount();
const { data: walletClient } = useWalletClient();
```

### Trade Console (`app/trade/page.tsx`)

**State Management**:
```typescript
const [formData, setFormData] = useState({
  agentId: "trend-follower",
  symbol: "BTC",
  side: "buy",
  size: 0.05,
  leverage: 1
});

const [tradeIntent, setTradeIntent] = useState<TradeIntent | null>(null);
const [executedTrade, setExecutedTrade] = useState<ExecutedTrade | null>(null);
const [loading, setLoading] = useState(false);
```

**Trade Execution Flow**:

```typescript
// Step 1: Get agent suggestion
async function handleGetSuggestion() {
  const response = await fetch("/api/agents/suggest", {
    method: "POST",
    body: JSON.stringify({
      agentId: formData.agentId,
      symbol: formData.symbol
    })
  });
  const suggestion = await response.json();
  setFormData(prev => ({ ...prev, ...suggestion }));
}

// Step 2: Create payment request
async function handleCreatePaymentRequest() {
  const response = await fetch("/api/trades/create-intent", {
    method: "POST",
    body: JSON.stringify({
      userAddress: address,
      ...formData
    })
  });
  const { tradeIntent, paymentRequest } = await response.json();
  setTradeIntent(tradeIntent);
}

// Step 3: Execute trade with x402 payment
async function handleExecuteTrade() {
  // x402-fetch automatically handles payment
  const response = await x402Fetch("/api/trades/execute", {
    method: "POST",
    body: JSON.stringify({
      tradeIntentId: tradeIntent.id
    }),
    wallet: walletClient // Wallet for signing payment
  });
  
  const { executedTrade } = await response.json();
  setExecutedTrade(executedTrade);
}
```

**UI Components**:
- Form for trade configuration
- Agent suggestion display
- Payment request details
- Execution receipt
- Recent trades table
- Portfolio balance display

---

## Smart Contracts

### Mock ERC20 Tokens (`contracts/src/MockERC20.sol`)

```solidity
contract MockERC20 is ERC20, Ownable {
    uint8 private _decimals;
    
    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals_
    ) ERC20(name, symbol) Ownable(msg.sender) {
        _decimals = decimals_;
    }
    
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
    
    function decimals() public view override returns (uint8) {
        return _decimals;
    }
}
```

### Deployment Scripts

**Deploy Tokens** (`contracts/script/DeployTokens.s.sol`):
```solidity
contract DeployTokens is Script {
    function run() external {
        vm.startBroadcast();
        
        // Deploy USDC (6 decimals)
        MockERC20 usdc = new MockERC20("Mock USDC", "USDC", 6);
        usdc.mint(msg.sender, 1_000_000 * 10**6);
        
        // Deploy WBTC (8 decimals)
        MockERC20 wbtc = new MockERC20("Mock WBTC", "WBTC", 8);
        wbtc.mint(msg.sender, 100 * 10**8);
        
        vm.stopBroadcast();
    }
}
```

**Create Uniswap Pool** (`contracts/script/DeployPool.s.sol`):
```solidity
contract DeployPool is Script {
    function run() external {
        vm.startBroadcast();
        
        // Create pool
        address pool = IUniswapV3Factory(FACTORY).createPool(
            USDC,
            WBTC,
            3000 // 0.3% fee
        );
        
        // Initialize price
        IUniswapV3Pool(pool).initialize(
            79228162514264337593543950336 // sqrt(1) in Q64.96
        );
        
        vm.stopBroadcast();
    }
}
```

---

## Security Considerations

### 1. Payment Verification
- **Cryptographic proof**: x402 uses signed payment proofs
- **Facilitator validation**: Third-party verification prevents fraud
- **Replay protection**: Payment IDs are single-use
- **Amount verification**: Exact payment amount checked

### 2. Smart Contract Interactions
- **Approval limits**: Only approve exact swap amount
- **Slippage protection**: Minimum output amount enforced
- **Deadline enforcement**: Transactions expire after 5 minutes
- **Execution wallet**: Separate wallet for trade execution

### 3. Database Security
- **SQL injection**: Prepared statements used throughout
- **Input validation**: Type checking on all inputs
- **Status transitions**: Enforced state machine (pending → paid → executed)

### 4. Frontend Security
- **Wallet connection**: User controls private keys
- **Transaction signing**: User approves each payment
- **HTTPS only**: Secure communication required
- **No custody**: Funds never held by platform

---

## Performance Optimizations

### 1. Database
- **Indexes**: On frequently queried columns (userAddress, status, timestamp)
- **Connection pooling**: Single database connection reused
- **Lazy initialization**: Database created on first use

### 2. Frontend
- **React Query**: Automatic caching and deduplication
- **Optimistic updates**: UI updates before confirmation
- **Code splitting**: Dynamic imports for large components
- **Memoization**: useMemo/useCallback for expensive computations

### 3. Blockchain
- **Batch approvals**: Approve max amount to reduce transactions
- **Gas estimation**: Accurate gas limits prevent failures
- **RPC caching**: Reuse public client instances

---

## Deployment Guide

### Environment Setup

```bash
# Backend
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
EXECUTION_PRIVATE_KEY=0x...
X402_PAYMENT_ADDRESS=0x...
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...

# Uniswap V3 (Base Sepolia)
UNISWAP_V3_FACTORY=0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24
UNISWAP_V3_SWAP_ROUTER=0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4
BASE_SEPOLIA_USDC_ADDRESS=0xB6c34A382a45F93682B03dCa9C48e3710e76809F
BASE_SEPOLIA_BTC_ADDRESS=0xb9B962177c15353cd6AA49E26c2b627b9CC35457
```

### Contract Deployment

```bash
cd contracts
forge install
./script/Deploy.sh
```

### Application Deployment

```bash
# Install dependencies
bun install

# Build
bun run build

# Start production server
bun run start
```

---

## Testing Strategy

### Unit Tests
- Agent strategy logic
- Payment verification
- Database operations
- Utility functions

### Integration Tests
- API route handlers
- x402 payment flow
- Uniswap swap execution
- Wallet connection

### E2E Tests
- Complete trade flow
- Payment confirmation
- Error handling
- UI interactions

---

## Future Enhancements

### 1. Advanced Trading
- **Limit orders**: Execute at specific prices
- **Stop-loss**: Automatic risk management
- **Multi-asset**: Support more token pairs
- **Advanced strategies**: ML-based agents

### 2. Infrastructure
- **Mainnet deployment**: Production-ready contracts
- **Multi-chain**: Support Arbitrum, Optimism, Polygon
- **Price oracles**: Chainlink integration
- **MEV protection**: Private transaction pools

### 3. User Experience
- **Portfolio tracking**: Historical P&L
- **Analytics dashboard**: Performance metrics
- **Mobile app**: React Native version
- **Notifications**: Trade alerts via Telegram/Discord

### 4. Security
- **Audit**: Third-party security review
- **Bug bounty**: Community-driven security
- **Insurance**: Trade execution guarantees
- **Multi-sig**: Enhanced payment security

---

## Troubleshooting

### Common Issues

**1. Swap fails with "insufficient liquidity"**
- Check pool has sufficient liquidity
- Increase slippage tolerance
- Verify token addresses are correct

**2. Payment verification fails**
- Ensure wallet is connected
- Check payment amount matches requirement
- Verify network (base-sepolia vs base)

**3. Transaction reverts**
- Check execution wallet has gas
- Verify token approvals
- Ensure pool is initialized

**4. Database errors**
- Check file permissions on agentpay.db
- Verify SQLite is installed
- Clear corrupted database and restart

---

## Conclusion

AgentPay Relay demonstrates a novel approach to decentralized trading by combining:
- **x402 protocol**: Pay-per-use model without custody
- **AI agents**: Automated trading strategies
- **Uniswap V3**: Deep liquidity access
- **Web3 wallets**: User sovereignty

The architecture is designed for scalability, security, and extensibility, making it suitable for both development and production deployment.
