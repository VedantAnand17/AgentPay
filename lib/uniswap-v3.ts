// Uniswap V3 spot exchange interaction on Base Sepolia
import {
  createWalletClient,
  createPublicClient,
  http,
  parseUnits,
  formatUnits,
  decodeEventLog,
} from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

// Primary RPC URL from environment
const BASE_SEPOLIA_RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";

// Fallback RPC URLs for Base Sepolia (tried in order if primary fails)
const BASE_SEPOLIA_RPC_FALLBACKS = [
  "https://sepolia.base.org",
  "https://base-sepolia.public.blastapi.io",
  "https://base-sepolia-rpc.publicnode.com",
  "https://base-sepolia.blockpi.network/v1/rpc/public",
];

const EXECUTION_PRIVATE_KEY = process.env.EXECUTION_PRIVATE_KEY || "";

// Uniswap V3 contract addresses on Base Sepolia (Official)
const UNISWAP_V3_FACTORY = (process.env.UNISWAP_V3_FACTORY || "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24") as `0x${string}`;
const UNISWAP_V3_SWAP_ROUTER = (process.env.UNISWAP_V3_SWAP_ROUTER || "0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4") as `0x${string}`;
const UNISWAP_V3_QUOTER = (process.env.UNISWAP_V3_QUOTER || "0xC5290058841028F1614F3A6F0F5816cAd0df5E27") as `0x${string}`;
const UNISWAP_V3_POSITION_MANAGER = (process.env.UNISWAP_V3_POSITION_MANAGER || "0x27F971cb582BF9E50F397e4d29a5C7A34f11faA2") as `0x${string}`;

// Pool configuration - deployed on Base Sepolia
const POOL_TOKEN0 = (process.env.POOL_TOKEN0_ADDRESS || "0x6FB6190cDa2ffdC1B2310Df62d5a3C0D4E1cFe29") as `0x${string}`; // WBTC
const POOL_TOKEN1 = (process.env.POOL_TOKEN1_ADDRESS || "0xB66d47e7D179695DA224D146948B55a8014Bbd6a") as `0x${string}`; // USDC
const POOL_FEE = Number(process.env.POOL_FEE || "3000"); // 0.3% fee tier
const POOL_ADDRESS = (process.env.UNISWAP_V3_POOL_ADDRESS || "0x657E53f847232D4b996890c6Fd11cb7396cBb0b6") as `0x${string}`;

// Slippage tolerance (default 1% for mainnet, higher for testnet)
const SLIPPAGE_TOLERANCE = parseFloat(process.env.SLIPPAGE_TOLERANCE || "0.05"); // 5% default

// Token configuration
interface TokenConfig {
  address: `0x${string}`;
  decimals: number;
}

const TOKEN_ADDRESSES: Record<string, TokenConfig> = {
  USDC: {
    address: (process.env.MOCK_USDC_ADDRESS || "0xB66d47e7D179695DA224D146948B55a8014Bbd6a") as `0x${string}`,
    decimals: 6,
  },
  WBTC: {
    address: (process.env.MOCK_WBTC_ADDRESS || "0x6FB6190cDa2ffdC1B2310Df62d5a3C0D4E1cFe29") as `0x${string}`,
    decimals: 8,
  },
  BTC: {
    address: (process.env.MOCK_WBTC_ADDRESS || "0x6FB6190cDa2ffdC1B2310Df62d5a3C0D4E1cFe29") as `0x${string}`,
    decimals: 8,
  },
  WETH: {
    address: "0x4200000000000000000000000000000000000006" as `0x${string}`,
    decimals: 18,
  },
};

/**
 * Get all RPC URLs to try (primary first, then fallbacks)
 */
function getRpcUrls(): string[] {
  return [BASE_SEPOLIA_RPC_URL, ...BASE_SEPOLIA_RPC_FALLBACKS.filter(rpc => rpc !== BASE_SEPOLIA_RPC_URL)];
}

/**
 * Create a public client with the specified RPC URL
 */
function createClientWithRpc(rpcUrl: string) {
  return createPublicClient({
    chain: baseSepolia,
    transport: http(rpcUrl, {
      timeout: 10000, // 10 second timeout
      retryCount: 1,
    }),
  });
}

/**
 * Execute an RPC call with automatic fallback to alternative RPCs
 */
async function withRpcFallback<T>(
  operation: (client: any) => Promise<T>,
  operationName: string = "RPC operation"
): Promise<T> {
  const rpcsToTry = getRpcUrls();
  let lastError: Error | null = null;

  for (const rpcUrl of rpcsToTry) {
    try {
      const client = createClientWithRpc(rpcUrl);
      return await operation(client);
    } catch (error: any) {
      lastError = error;
      console.warn(`RPC ${rpcUrl} failed for ${operationName}:`, error.message);
      // Continue to next RPC
    }
  }

  throw new Error(`${operationName} failed after trying ${rpcsToTry.length} RPCs: ${lastError?.message || "Unknown error"}`);
}

// ERC20 ABI
const ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;

// Uniswap V3 SwapRouter02 ABI (exactInputSingle)
const SWAP_ROUTER_ABI = [
  {
    name: "exactInputSingle",
    type: "function",
    stateMutability: "payable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "recipient", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "amountOutMinimum", type: "uint256" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
  {
    name: "exactOutputSingle",
    type: "function",
    stateMutability: "payable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "recipient", type: "address" },
          { name: "amountOut", type: "uint256" },
          { name: "amountInMaximum", type: "uint256" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [{ name: "amountIn", type: "uint256" }],
  },
] as const;

// QuoterV2 ABI for getting quotes
const QUOTER_V2_ABI = [
  {
    name: "quoteExactInputSingle",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "fee", type: "uint24" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [
      { name: "amountOut", type: "uint256" },
      { name: "sqrtPriceX96After", type: "uint160" },
      { name: "initializedTicksCrossed", type: "uint32" },
      { name: "gasEstimate", type: "uint256" },
    ],
  },
] as const;

// Uniswap V3 Pool ABI
const POOL_ABI = [
  {
    name: "slot0",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "sqrtPriceX96", type: "uint160" },
      { name: "tick", type: "int24" },
      { name: "observationIndex", type: "uint16" },
      { name: "observationCardinality", type: "uint16" },
      { name: "observationCardinalityNext", type: "uint16" },
      { name: "feeProtocol", type: "uint8" },
      { name: "unlocked", type: "bool" },
    ],
  },
  {
    name: "liquidity",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint128" }],
  },
  {
    name: "token0",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "token1",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "fee",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint24" }],
  },
  {
    name: "Swap",
    type: "event",
    inputs: [
      { name: "sender", type: "address", indexed: true },
      { name: "recipient", type: "address", indexed: true },
      { name: "amount0", type: "int256", indexed: false },
      { name: "amount1", type: "int256", indexed: false },
      { name: "sqrtPriceX96", type: "uint160", indexed: false },
      { name: "liquidity", type: "uint128", indexed: false },
      { name: "tick", type: "int24", indexed: false },
    ],
  },
] as const;

// Factory ABI
const FACTORY_ABI = [
  {
    name: "getPool",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
      { name: "fee", type: "uint24" },
    ],
    outputs: [{ name: "pool", type: "address" }],
  },
] as const;

/**
 * Get a quote for a swap using QuoterV2
 */
export async function getSwapQuote(args: {
  tokenIn: `0x${string}`;
  tokenOut: `0x${string}`;
  amountIn: bigint;
  fee?: number;
}): Promise<{ amountOut: bigint; priceImpact: number }> {
  return await withRpcFallback(async (publicClient) => {
    const result = await publicClient.simulateContract({
      address: UNISWAP_V3_QUOTER,
      abi: QUOTER_V2_ABI,
      functionName: "quoteExactInputSingle",
      args: [
        {
          tokenIn: args.tokenIn,
          tokenOut: args.tokenOut,
          amountIn: args.amountIn,
          fee: args.fee || POOL_FEE,
          sqrtPriceLimitX96: BigInt(0), // No price limit
        },
      ],
    });

    const [amountOut] = result.result as [bigint, bigint, number, bigint];

    // Calculate rough price impact (simplified)
    const priceImpact = 0; // Would need to compare with oracle price

    return { amountOut, priceImpact };
  }, "getSwapQuote");
}

/**
 * Execute a spot swap on Uniswap V3
 */
export async function executeUniswapV3Swap(args: {
  userAddress: string;
  symbol: string;
  side: "buy" | "sell";
  size: number;
  leverage?: number;
}): Promise<{ txHash: string; executionPrice: number }> {
  if (!EXECUTION_PRIVATE_KEY) {
    throw new Error("EXECUTION_PRIVATE_KEY not configured");
  }

  // Validate token configuration
  const tokenConfig = TOKEN_ADDRESSES[args.symbol];
  if (!tokenConfig || tokenConfig.address === "0x0000000000000000000000000000000000000000") {
    throw new Error(
      `Token ${args.symbol} not configured. Please set MOCK_${args.symbol}_ADDRESS or POOL_TOKEN addresses in environment.`
    );
  }

  const usdcConfig = TOKEN_ADDRESSES.USDC;
  if (usdcConfig.address === "0x0000000000000000000000000000000000000000") {
    throw new Error("USDC not configured. Please set MOCK_USDC_ADDRESS in environment.");
  }

  try {
    const account = privateKeyToAccount(`0x${EXECUTION_PRIVATE_KEY.replace(/^0x/, "")}` as `0x${string}`);

    const walletClient = createWalletClient({
      account,
      chain: baseSepolia,
      transport: http(BASE_SEPOLIA_RPC_URL),
    });

    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(BASE_SEPOLIA_RPC_URL),
    });

    // Determine token addresses based on side
    const tokenIn = args.side === "buy" ? usdcConfig.address : tokenConfig.address;
    const tokenOut = args.side === "buy" ? tokenConfig.address : usdcConfig.address;
    const tokenInDecimals = args.side === "buy" ? usdcConfig.decimals : tokenConfig.decimals;
    const tokenOutDecimals = args.side === "buy" ? tokenConfig.decimals : usdcConfig.decimals;

    // Convert size to token units
    const amountIn = parseUnits(args.size.toString(), tokenInDecimals);

    console.log("Swap parameters:", {
      tokenIn,
      tokenOut,
      amountIn: amountIn.toString(),
      side: args.side,
      symbol: args.symbol,
    });

    // Check token balance
    const balance = await publicClient.readContract({
      address: tokenIn,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [account.address],
    });

    if (balance < amountIn) {
      throw new Error(
        `Insufficient balance. Required: ${formatUnits(amountIn, tokenInDecimals)}, Available: ${formatUnits(balance, tokenInDecimals)}`
      );
    }

    // Check and approve if needed
    const allowance = await publicClient.readContract({
      address: tokenIn,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [account.address, UNISWAP_V3_SWAP_ROUTER],
    });

    if (allowance < amountIn) {
      console.log("Approving SwapRouter...");
      const approveHash = await walletClient.writeContract({
        address: tokenIn,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [UNISWAP_V3_SWAP_ROUTER, amountIn * BigInt(2)],
      });
      await publicClient.waitForTransactionReceipt({ hash: approveHash });
      console.log("Approval confirmed:", approveHash);
    }

    // Get quote for minimum output
    let amountOutMinimum: bigint;
    try {
      const quote = await getSwapQuote({
        tokenIn,
        tokenOut,
        amountIn,
        fee: POOL_FEE,
      });
      // Apply slippage tolerance
      const slippageBps = BigInt(Math.floor(SLIPPAGE_TOLERANCE * 10000));
      amountOutMinimum = (quote.amountOut * (BigInt(10000) - slippageBps)) / BigInt(10000);
      console.log("Quote:", {
        expectedOut: formatUnits(quote.amountOut, tokenOutDecimals),
        minOut: formatUnits(amountOutMinimum, tokenOutDecimals),
        slippage: `${SLIPPAGE_TOLERANCE * 100}%`,
      });
    } catch (quoteError) {
      console.error("Could not get quote — aborting swap to prevent sandwich attacks:", quoteError);
      throw new Error(
        "Failed to get swap quote. Cannot execute swap without a minimum output amount (sandwich attack protection). " +
        "Please try again or check pool liquidity."
      );
    }

    // Execute swap
    console.log("Executing swap...");
    const swapHash = await walletClient.writeContract({
      address: UNISWAP_V3_SWAP_ROUTER,
      abi: SWAP_ROUTER_ABI,
      functionName: "exactInputSingle",
      args: [
        {
          tokenIn,
          tokenOut,
          fee: POOL_FEE,
          recipient: args.userAddress as `0x${string}`,
          amountIn,
          amountOutMinimum,
          sqrtPriceLimitX96: BigInt(0), // No price limit
        },
      ],
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: swapHash });

    if (receipt.status === "reverted") {
      throw new Error(`Swap transaction reverted. Hash: ${swapHash}`);
    }

    // Parse swap events to get actual output
    let actualAmountOut = BigInt(0);
    let executionPrice = 0;

    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: POOL_ABI,
          data: log.data,
          topics: log.topics,
        });

        if (decoded.eventName === "Swap") {
          const { amount0, amount1 } = decoded.args as { amount0: bigint; amount1: bigint };
          // Determine output based on which amount is positive (received)
          actualAmountOut = amount0 > BigInt(0) ? amount0 : amount1 > BigInt(0) ? amount1 : BigInt(0);
          if (actualAmountOut < BigInt(0)) {
            actualAmountOut = -actualAmountOut;
          }
          break;
        }
      } catch {
        // Not a Swap event
      }
    }

    // Calculate execution price
    if (actualAmountOut > BigInt(0)) {
      const amountInFloat = Number(formatUnits(amountIn, tokenInDecimals));
      const amountOutFloat = Number(formatUnits(actualAmountOut, tokenOutDecimals));

      if (args.side === "buy") {
        executionPrice = amountInFloat / amountOutFloat; // USDC per token
      } else {
        executionPrice = amountOutFloat / amountInFloat; // USDC per token
      }
    } else {
      // Fallback: use mock price
      executionPrice = await getCurrentPriceV3(args.symbol);
    }

    console.log("Swap completed:", {
      txHash: swapHash,
      actualAmountOut: actualAmountOut.toString(),
      executionPrice,
    });

    return {
      txHash: swapHash,
      executionPrice,
    };
  } catch (error: any) {
    console.error("Swap error:", error);
    throw new Error(`Failed to execute Uniswap V3 swap: ${error.message}`);
  }
}

/**
 * Check if a pool exists for the given token pair (with RPC fallback)
 */
export async function checkPoolExists(
  tokenA: `0x${string}`,
  tokenB: `0x${string}`,
  fee: number = POOL_FEE
): Promise<`0x${string}` | null> {
  try {
    return await withRpcFallback(async (publicClient) => {
      const poolAddress = await publicClient.readContract({
        address: UNISWAP_V3_FACTORY,
        abi: FACTORY_ABI,
        functionName: "getPool",
        args: [tokenA, tokenB, fee],
      });

      if (poolAddress === "0x0000000000000000000000000000000000000000") {
        return null;
      }

      return poolAddress as `0x${string}`;
    }, "checkPoolExists");
  } catch (error) {
    console.error("Error checking pool:", error);
    return null;
  }
}

/**
 * Get pool liquidity information with RPC fallback
 */
export async function getPoolInfo(): Promise<{
  poolAddress: string;
  token0: string;
  token1: string;
  fee: number;
  liquidity: string;
  sqrtPriceX96: string;
  tick: number;
} | null> {
  if (!POOL_ADDRESS) {
    console.warn("POOL_ADDRESS not configured");
    return null;
  }

  try {
    return await withRpcFallback(async (publicClient) => {
      const [slot0, liquidity, token0, token1, fee] = await Promise.all([
        publicClient.readContract({
          address: POOL_ADDRESS,
          abi: POOL_ABI,
          functionName: "slot0",
        }),
        publicClient.readContract({
          address: POOL_ADDRESS,
          abi: POOL_ABI,
          functionName: "liquidity",
        }),
        publicClient.readContract({
          address: POOL_ADDRESS,
          abi: POOL_ABI,
          functionName: "token0",
        }),
        publicClient.readContract({
          address: POOL_ADDRESS,
          abi: POOL_ABI,
          functionName: "token1",
        }),
        publicClient.readContract({
          address: POOL_ADDRESS,
          abi: POOL_ABI,
          functionName: "fee",
        }),
      ]);

      const slot0Array = slot0 as unknown as [bigint, number, number, number, number, number, boolean];
      const [sqrtPriceX96, tick] = slot0Array;

      return {
        poolAddress: POOL_ADDRESS,
        token0: token0 as string,
        token1: token1 as string,
        fee: fee as number,
        liquidity: liquidity.toString(),
        sqrtPriceX96: sqrtPriceX96.toString(),
        tick,
      };
    }, "getPoolInfo");
  } catch (error) {
    console.error("Error getting pool info:", error);
    return null;
  }
}

/**
 * Get current price for a symbol
 * Tries CoinGecko API first for accurate USD prices, then falls back to pool price
 */
export async function getCurrentPriceV3(symbol: string): Promise<number> {
  // First, try to get real market price from CoinGecko
  try {
    const coinGeckoIds: Record<string, string> = {
      BTC: "bitcoin",
      WBTC: "wrapped-bitcoin",
      ETH: "ethereum",
      WETH: "ethereum",
    };

    const coinId = coinGeckoIds[symbol.toUpperCase()];
    if (coinId) {
      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`,
        { signal: AbortSignal.timeout(5000) }
      );

      if (response.ok) {
        const data = await response.json();
        if (data[coinId]?.usd) {
          return data[coinId].usd;
        }
      }
    }
  } catch (error) {
    // CoinGecko failed, try pool price
    console.debug("CoinGecko price fetch failed, trying pool price:", error);
  }

  // Fallback: Try to get price from pool
  const poolInfo = await getPoolInfo();
  if (poolInfo && poolInfo.sqrtPriceX96) {
    // Calculate price from sqrtPriceX96
    // price = (sqrtPriceX96 / 2^96)^2
    const sqrtPriceX96 = BigInt(poolInfo.sqrtPriceX96);
    const Q96 = BigInt(2) ** BigInt(96);

    // price = (sqrtPriceX96^2) / (2^192)
    const priceX192 = sqrtPriceX96 * sqrtPriceX96;
    const Q192 = Q96 * Q96;

    // Adjust for decimals (USDC has 6, WBTC has 8)
    // If token0 is USDC and token1 is WBTC:
    // price represents WBTC/USDC, need to invert for USDC/WBTC
    const rawPrice = Number(priceX192) / Number(Q192);

    // Adjust for decimal difference (10^6 / 10^8 = 10^-2)
    const decimalAdjustedPrice = rawPrice * (10 ** (8 - 6));

    // Invert to get USDC per WBTC
    const usdcPerWbtc = 1 / decimalAdjustedPrice;

    if (usdcPerWbtc > 0 && usdcPerWbtc < 1000000) {
      return usdcPerWbtc;
    }
  }

  // Last resort: Use approximate market prices
  const basePrices: Record<string, number> = {
    BTC: 97000,
    WBTC: 97000,
    ETH: 3400,
    WETH: 3400,
  };

  return basePrices[symbol] || 97000;
}

/**
 * Get token balance with RPC fallback support
 * Tries primary RPC first, then falls back to alternative RPCs if it fails
 */
export async function getTokenBalanceV3(
  userAddress: string,
  symbol: string
): Promise<{ balance: string; formatted: string }> {
  const tokenInfo = TOKEN_ADDRESSES[symbol];
  if (!tokenInfo || tokenInfo.address === "0x0000000000000000000000000000000000000000") {
    throw new Error(`Token ${symbol} not configured`);
  }

  return await withRpcFallback(async (publicClient) => {
    const balance = await publicClient.readContract({
      address: tokenInfo.address,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [userAddress as `0x${string}`],
    });

    return {
      balance: balance.toString(),
      formatted: formatUnits(balance, tokenInfo.decimals),
    };
  }, `getTokenBalance(${symbol})`);
}

/**
 * Check available pools for a token pair
 */
export async function checkAvailablePoolsV3(
  tokenA: string,
  tokenB: string
): Promise<Array<{ fee: number; feePercent: string; poolAddress: string }>> {
  const tokenAConfig = TOKEN_ADDRESSES[tokenA];
  const tokenBConfig = TOKEN_ADDRESSES[tokenB];

  if (!tokenAConfig || !tokenBConfig) {
    throw new Error(`Token not found: ${tokenA} or ${tokenB}`);
  }

  const pools: Array<{ fee: number; feePercent: string; poolAddress: string }> = [];

  // Check common fee tiers
  const feeTiers = [500, 3000, 10000]; // 0.05%, 0.3%, 1%

  for (const fee of feeTiers) {
    const poolAddress = await checkPoolExists(tokenAConfig.address, tokenBConfig.address, fee);
    if (poolAddress) {
      pools.push({
        fee,
        feePercent: `${fee / 10000}%`,
        poolAddress,
      });
    }
  }

  return pools;
}

/**
 * Validate swap parameters
 */
export async function validateSwapV3(args: {
  symbol: string;
  side: "buy" | "sell";
  size: number;
}): Promise<{
  valid: boolean;
  warnings: string[];
  errors: string[];
  suggestedSize?: number;
}> {
  const warnings: string[] = [];
  const errors: string[] = [];
  let valid = true;

  // Check if tokens are configured
  const tokenConfig = TOKEN_ADDRESSES[args.symbol];
  if (!tokenConfig || tokenConfig.address === "0x0000000000000000000000000000000000000000") {
    errors.push(`Token ${args.symbol} not configured. Deploy mock tokens and set addresses in environment.`);
    valid = false;
  }

  const usdcConfig = TOKEN_ADDRESSES.USDC;
  if (usdcConfig.address === "0x0000000000000000000000000000000000000000") {
    errors.push("USDC not configured. Deploy mock USDC and set MOCK_USDC_ADDRESS in environment.");
    valid = false;
  }

  // Check if pool exists
  if (valid) {
    const poolAddress = await checkPoolExists(usdcConfig.address, tokenConfig.address, POOL_FEE);
    if (!poolAddress) {
      errors.push(
        `No pool exists for USDC/${args.symbol} with ${POOL_FEE / 10000}% fee. ` +
        `Deploy a pool using the contracts/script/DeployPool.s.sol script.`
      );
      valid = false;
    }
  }

  // Check swap size
  if (args.size <= 0) {
    errors.push("Swap size must be positive");
    valid = false;
  }

  if (args.size < 1) {
    warnings.push("Small swap sizes may have high relative price impact");
  }

  if (args.size > 10000) {
    warnings.push("Large swap sizes may have significant price impact. Consider splitting into smaller swaps.");
  }

  return {
    valid,
    warnings,
    errors,
    suggestedSize: valid ? undefined : 100,
  };
}

// Export configuration for external use
export const UNISWAP_V3_CONFIG = {
  factory: UNISWAP_V3_FACTORY,
  swapRouter: UNISWAP_V3_SWAP_ROUTER,
  quoter: UNISWAP_V3_QUOTER,
  positionManager: UNISWAP_V3_POSITION_MANAGER,
  poolFee: POOL_FEE,
  poolAddress: POOL_ADDRESS,
  tokens: TOKEN_ADDRESSES,
};
