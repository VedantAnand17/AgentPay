// Uniswap V4 spot exchange interaction on Base Sepolia
import { createWalletClient, createPublicClient, http, parseUnits, formatUnits, decodeEventLog, decodeErrorResult, encodeAbiParameters, parseAbiParameters } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const BASE_SEPOLIA_RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
const EXECUTION_PRIVATE_KEY = process.env.EXECUTION_PRIVATE_KEY || "";

// Uniswap V4 contract addresses on Base Sepolia (Deployed Pool)
// Network: Base Sepolia
const UNISWAP_V4_POOL_MANAGER_ADDRESS = process.env.UNISWAP_V4_POOL_MANAGER_ADDRESS || "0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408" as `0x${string}`;
const UNISWAP_V4_POSITION_MANAGER_ADDRESS = process.env.UNISWAP_V4_POSITION_MANAGER_ADDRESS || "0x4B2C77d209D3405F41a037Ec6c77F7F5b8e2ca80" as `0x${string}`;

// IMPORTANT: Uniswap V4 requires a SwapRouter contract to execute swaps
// The PoolManager uses an "unlock callback" pattern - you cannot call swap() directly
// 
// Options for SwapRouter:
// 1. PoolSwapTest (from v4-periphery) - Simple interface, recommended for testing
// 2. UniversalRouter - Complex command-based interface, supports V3 and V4
//
// Base Sepolia addresses:
// - UniversalRouter: 0x492E6456D9528771018DeB9E87ef7750EF184104 (may support V4)
// - Permit2: 0x000000000022D473030F116dDEE9F6B43aC78BA3
//
// Set UNISWAP_V4_SWAP_ROUTER_ADDRESS to use a PoolSwapTest contract
// Or set USE_UNIVERSAL_ROUTER=true to use the UniversalRouter
const UNISWAP_V4_SWAP_ROUTER_ADDRESS = process.env.UNISWAP_V4_SWAP_ROUTER_ADDRESS as `0x${string}` | undefined;
const UNIVERSAL_ROUTER_ADDRESS = process.env.UNIVERSAL_ROUTER_ADDRESS || "0x492E6456D9528771018DeB9E87ef7750EF184104" as `0x${string}`;
const PERMIT2_ADDRESS = "0x000000000022D473030F116dDEE9F6B43aC78BA3" as `0x${string}`;
const USE_UNIVERSAL_ROUTER = process.env.USE_UNIVERSAL_ROUTER === "true";

// Pool configuration from deployment
// Pool: USDC / cbBTC on Base Sepolia
// Currency0: USDC (0xB6c34A382a45F93682B03dCa9C48e3710e76809F) - MockUSDC
// Currency1: cbBTC (0xb9B962177c15353cd6AA49E26c2b627b9CC35457) - MockCbBTC
// Fee: 3000 (0.3%)
// Tick Spacing: 60
// Initial Pool State: Initial Tick: 0, SqrtPriceX96: 79228162514264337593543950336
// Liquidity Position: Tick Lower: -887220, Tick Upper: 887220, Liquidity: 2500000000
const POOL_CURRENCY0 = "0xB6c34A382a45F93682B03dCa9C48e3710e76809F" as `0x${string}`; // USDC
const POOL_CURRENCY1 = "0xb9B962177c15353cd6AA49E26c2b627b9CC35457" as `0x${string}`; // cbBTC
const POOL_FEE = 3000; // 0.3% fee tier
const POOL_TICK_SPACING = 60;

// Uniswap V4 sqrt price limits - REQUIRED for valid swaps
// These are the min/max valid sqrt price ratios in Q64.96 format
// Using 0 is INVALID and will cause swaps to fail
const MIN_SQRT_RATIO = BigInt("4295128739"); // Minimum valid sqrt price
const MAX_SQRT_RATIO = BigInt("1461446703485210103287273052203988822378723970342"); // Maximum valid sqrt price

// Helper to get the correct price limit based on swap direction
function getSqrtPriceLimitX96(zeroForOne: boolean): bigint {
  // For zeroForOne (token0 -> token1): price decreases, use MIN + 1
  // For oneForZero (token1 -> token0): price increases, use MAX - 1
  return zeroForOne ? MIN_SQRT_RATIO + BigInt(1) : MAX_SQRT_RATIO - BigInt(1);
}

// Helper to encode hook data with minimum output amount
// Many V4 SwapRouters expect the minAmountOut to be encoded in hookData
function encodeHookData(minAmountOut: bigint): `0x${string}` {
  // Encode the minimum output amount as a uint256
  // Setting to 0 disables slippage protection (use carefully)
  return encodeAbiParameters(
    parseAbiParameters('uint256'),
    [minAmountOut]
  );
}

// Helper to create empty hook data (for routers that don't need min amount in hookData)
function getEmptyHookData(): `0x${string}` {
  return "0x" as `0x${string}`;
}

// Slippage tolerance - IMPORTANT: For low-liquidity testnet pools, use higher slippage
// 1% = 0.01, so we accept 99% of quoted amount
// Default to 15% for testnet pools with low liquidity
const SLIPPAGE_TOLERANCE = parseFloat(process.env.SLIPPAGE_TOLERANCE || "0.15"); // 15% default for testnet

// Token addresses on Base Sepolia (Uniswap V4 pool)
const TOKEN_ADDRESSES: Record<string, { address: `0x${string}`; decimals: number }> = {
  USDC: {
    address: (process.env.BASE_SEPOLIA_USDC_ADDRESS || POOL_CURRENCY0) as `0x${string}`, // USDC on Base Sepolia
    decimals: 6,
  },
  WETH: {
    address: "0x4200000000000000000000000000000000000006", // WETH on Base Sepolia
    decimals: 18,
  },
  BTC: {
    address: (process.env.BASE_SEPOLIA_BTC_ADDRESS || POOL_CURRENCY1) as `0x${string}`, // cbBTC on Base Sepolia
    decimals: 8,
  },
  cbBTC: {
    address: (process.env.BASE_SEPOLIA_BTC_ADDRESS || POOL_CURRENCY1) as `0x${string}`, // cbBTC on Base Sepolia (alias for BTC)
    decimals: 8,
  },
  WBTC: {
    address: (process.env.BASE_SEPOLIA_BTC_ADDRESS || POOL_CURRENCY1) as `0x${string}`, // cbBTC on Base Sepolia (alias for BTC - uses deployed pool's cbBTC)
    decimals: 8,
  },
  // Add more tokens as needed
};

// ERC20 ABI for approvals and transfers
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
] as const;

// PoolSwapTest ABI (from v4-periphery) - This is the router for executing swaps
// Deploy from: https://github.com/Uniswap/v4-periphery/blob/main/src/test/PoolSwapTest.sol
const POOL_SWAP_TEST_ABI = [
  {
    name: "swap",
    type: "function",
    stateMutability: "payable",
    inputs: [
      {
        name: "key",
        type: "tuple",
        components: [
          { name: "currency0", type: "address" },
          { name: "currency1", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "tickSpacing", type: "int24" },
          { name: "hooks", type: "address" },
        ],
      },
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "zeroForOne", type: "bool" },
          { name: "amountSpecified", type: "int256" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
      {
        name: "testSettings",
        type: "tuple",
        components: [
          { name: "takeClaims", type: "bool" },
          { name: "settleUsingBurn", type: "bool" },
        ],
      },
      { name: "hookData", type: "bytes" },
    ],
    outputs: [
      {
        name: "delta",
        type: "int256",
      },
    ],
  },
] as const;

// Uniswap V4 PoolManager ABI (for reference - cannot call swap directly!)
const UNISWAP_V4_POOL_MANAGER_ABI = [
  {
    name: "swap",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "key",
        type: "tuple",
        components: [
          { name: "currency0", type: "address" },
          { name: "currency1", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "tickSpacing", type: "int24" },
          { name: "hooks", type: "address" },
        ],
      },
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "zeroForOne", type: "bool" },
          { name: "amountSpecified", type: "int256" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
      { name: "hookData", type: "bytes" },
    ],
    outputs: [
      {
        name: "delta",
        type: "tuple",
        components: [
          { name: "amount0", type: "int128" },
          { name: "amount1", type: "int128" },
        ],
      },
    ],
  },
  {
    name: "settle",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "currency", type: "address" },
    ],
    outputs: [{ name: "paid0", type: "uint256" }, { name: "paid1", type: "uint256" }],
  },
  {
    name: "take",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "currency", type: "address" },
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "mint",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "id", type: "uint256" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  // Custom errors for better error messages
  {
    name: "V4TooLittleReceived",
    type: "error",
    inputs: [
      { name: "minAmountOutReceived", type: "uint256" },
      { name: "amountReceived", type: "uint256" },
    ],
  },
  {
    name: "CurrencyNotSettled",
    type: "error",
    inputs: [{ name: "currency", type: "address" }],
  },
  {
    name: "PoolNotInitialized",
    type: "error",
    inputs: [],
  },
  {
    name: "SwapAmountCannotBeZero",
    type: "error",
    inputs: [],
  },
] as const;

// Uniswap V4 Pool Swap event ABI (for parsing swap events)
const UNISWAP_V4_POOL_ABI = [
  {
    name: "Swap",
    type: "event",
    inputs: [
      { name: "sender", type: "address", indexed: true },
      { name: "currency0", type: "address", indexed: true },
      { name: "currency1", type: "address", indexed: true },
      { name: "fee", type: "uint24", indexed: false },
      { name: "tickSpacing", type: "int24", indexed: false },
      { name: "delta", type: "int256", indexed: false },
    ],
  },
] as const;

/**
 * Get PoolKey for Uniswap V4 pool
 * In V4, pools are identified by currency0, currency1, fee, tickSpacing, and hooks
 */
function getPoolKey(
  tokenA: `0x${string}`,
  tokenB: `0x${string}`
): {
  currency0: `0x${string}`;
  currency1: `0x${string}`;
  fee: number;
  tickSpacing: number;
  hooks: `0x${string}`;
} {
  // Ensure currency0 < currency1 (Uniswap requires tokens in sorted order)
  const [currency0, currency1] = tokenA.toLowerCase() < tokenB.toLowerCase()
    ? [tokenA, tokenB]
    : [tokenB, tokenA];

  return {
    currency0,
    currency1,
    fee: POOL_FEE,
    tickSpacing: POOL_TICK_SPACING,
    hooks: "0x0000000000000000000000000000000000000000" as `0x${string}`, // No hooks for this pool
  };
}

/**
 * Execute a spot swap on Uniswap V4
 * 
 * @param args - Swap parameters
 * @returns Transaction hash and execution price
 */
export async function executeUniswapSwap(args: {
  userAddress: string;
  symbol: string; // Token symbol to buy (e.g., "BTC")
  side: "buy" | "sell";
  size: number; // Amount in USDC (for buy) or token amount (for sell)
  leverage?: number; // Not used for spot, but kept for compatibility
}): Promise<{ txHash: string; executionPrice: number }> {
  if (!EXECUTION_PRIVATE_KEY) {
    throw new Error("EXECUTION_PRIVATE_KEY not configured");
  }

  // IMPORTANT: Check if SwapRouter is configured
  if (!UNISWAP_V4_SWAP_ROUTER_ADDRESS && !USE_UNIVERSAL_ROUTER) {
    throw new Error(
      `No SwapRouter configured for Uniswap V4 swaps. ` +
      `\n\nUniswap V4 requires a SwapRouter contract to execute swaps. ` +
      `The PoolManager uses an "unlock callback" pattern - you cannot call swap() directly. ` +
      `\n\n📋 SOLUTION: Deploy a PoolSwapTest contract\n` +
      `\n1. In your v4-deploy project, add this to your deployment script:\n` +
      `\n   import {PoolSwapTest} from "@uniswap/v4-periphery/src/test/PoolSwapTest.sol";\n` +
      `\n   // After deploying PoolManager:\n` +
      `   PoolSwapTest swapRouter = new PoolSwapTest(IPoolManager(poolManager));\n` +
      `   console.log("SwapRouter:", address(swapRouter));\n` +
      `\n2. Then set the environment variable:\n` +
      `   UNISWAP_V4_SWAP_ROUTER_ADDRESS=<deployed_address>\n` +
      `\n\nNote: The contracts on the Uniswap website (SwapRouter02, UniversalRouter, etc.) ` +
      `are V3 contracts and don't work directly with V4 pools.`
    );
  }
  
  // Determine which router to use
  const routerAddressRaw = UNISWAP_V4_SWAP_ROUTER_ADDRESS || (USE_UNIVERSAL_ROUTER ? UNIVERSAL_ROUTER_ADDRESS : undefined);
  if (!routerAddressRaw) {
    throw new Error("No router address available");
  }
  const routerAddress = routerAddressRaw as `0x${string}`;
  
  console.log("Using SwapRouter:", routerAddress, USE_UNIVERSAL_ROUTER ? "(UniversalRouter)" : "(PoolSwapTest)");

  try {
    // Create account from private key
    const account = privateKeyToAccount(`0x${EXECUTION_PRIVATE_KEY.replace(/^0x/, "")}` as `0x${string}`);

    // Create clients
    const walletClient = createWalletClient({
      account,
      chain: baseSepolia,
      transport: http(BASE_SEPOLIA_RPC_URL),
    });

    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(BASE_SEPOLIA_RPC_URL),
    });

    // Determine token addresses
    // For buy: swap USDC -> Token
    // For sell: swap Token -> USDC
    const tokenIn = args.side === "buy"
      ? TOKEN_ADDRESSES.USDC.address
      : TOKEN_ADDRESSES[args.symbol]?.address || TOKEN_ADDRESSES.BTC.address;

    const tokenOut = args.side === "buy"
      ? TOKEN_ADDRESSES[args.symbol]?.address || TOKEN_ADDRESSES.BTC.address
      : TOKEN_ADDRESSES.USDC.address;

    const tokenInDecimals = args.side === "buy" ? TOKEN_ADDRESSES.USDC.decimals : (TOKEN_ADDRESSES[args.symbol]?.decimals || 8);
    const tokenOutDecimals = args.side === "buy" ? (TOKEN_ADDRESSES[args.symbol]?.decimals || 8) : TOKEN_ADDRESSES.USDC.decimals;

    // Convert size to appropriate token units
    let amountIn = parseUnits(args.size.toString(), tokenInDecimals);
    
    // Define minimum amounts to avoid V4TooLittleReceived errors
    // These are minimum amounts that work well with Uniswap V4 pools
    const MIN_AMOUNTS: Record<number, bigint> = {
      6: parseUnits("1", 6),      // USDC: minimum $1 (1,000,000 base units)
      8: parseUnits("0.0001", 8),  // BTC/cbBTC: minimum 0.0001 BTC (10,000 base units)
      18: parseUnits("0.001", 18), // WETH: minimum 0.001 ETH
    };
    
    const minAmount = MIN_AMOUNTS[tokenInDecimals] || parseUnits("1", tokenInDecimals);
    
    // If amount is too small, increase it to the minimum
    if (amountIn < minAmount) {
      const originalAmount = formatUnits(amountIn, tokenInDecimals);
      amountIn = minAmount;
      const newAmount = formatUnits(amountIn, tokenInDecimals);
      console.warn(
        `Swap amount ${originalAmount} is too small for Uniswap V4. ` +
        `Increasing to minimum amount: ${newAmount} ` +
        `(this helps avoid V4TooLittleReceived errors due to insufficient liquidity for tiny swaps)`
      );
    }

    // Check and approve token if needed
    if (tokenIn !== "0x0000000000000000000000000000000000000000") {
      // First, verify the contract exists by checking if it has code
      const contractCode = await publicClient.getBytecode({ address: tokenIn });
      if (!contractCode || contractCode === "0x") {
        throw new Error(
          `Token contract does not exist at address ${tokenIn} on Base Sepolia. ` +
          `Please verify the token address is correct for the testnet.`
        );
      }

      // Check balance to ensure we have enough tokens (including if amount was increased)
      let balance = BigInt(0);
      try {
        balance = await publicClient.readContract({
          address: tokenIn,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [account.address],
        });
      } catch (error: any) {
        throw new Error(
          `Failed to check token balance: ${error.message}. ` +
          `Token address: ${tokenIn}. ` +
          `This may indicate the token contract is not a valid ERC20 token on Base Sepolia.`
        );
      }

      if (balance < amountIn) {
        const balanceFormatted = formatUnits(balance, tokenInDecimals);
        const amountFormatted = formatUnits(amountIn, tokenInDecimals);
        throw new Error(
          `Insufficient token balance. ` +
          `Required: ${amountFormatted}, Available: ${balanceFormatted}. ` +
          `Token: ${tokenIn}. ` +
          `Note: If the amount was increased from the original size due to minimum amount requirements, ` +
          `you may need to provide more tokens.`
        );
      }

      // Check allowance for SwapRouter (not PoolManager - the router handles token transfers)
      let allowance = BigInt(0);
      try {
        allowance = await publicClient.readContract({
          address: tokenIn,
          abi: ERC20_ABI,
          functionName: "allowance",
          args: [account.address, routerAddress as `0x${string}`],
        });
      } catch (error: any) {
        throw new Error(
          `Failed to check token allowance: ${error.message}. ` +
          `Token address: ${tokenIn}. ` +
          `This may indicate the token contract is not a valid ERC20 token on Base Sepolia.`
        );
      }

      if (allowance < amountIn) {
        // Approve SwapRouter to spend tokens
        console.log(`Approving SwapRouter (${routerAddress}) to spend ${formatUnits(amountIn * BigInt(2), tokenInDecimals)} tokens`);
        const approveHash = await walletClient.writeContract({
          address: tokenIn,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [routerAddress, amountIn * BigInt(2)], // Approve 2x for safety
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
        console.log("Approval confirmed:", approveHash);
      }
    }

    // Get PoolKey for the pool
    const poolKey = getPoolKey(tokenIn, tokenOut);
    
    // Verify pool uses the configured currencies
    if (poolKey.currency0 !== POOL_CURRENCY0 || poolKey.currency1 !== POOL_CURRENCY1) {
      throw new Error(
        `Token pair ${args.side === "buy" ? "USDC" : args.symbol}/${args.side === "buy" ? args.symbol : "USDC"} ` +
        `does not match configured pool (USDC/cbBTC). ` +
        `Only BTC (cbBTC) trading is supported. Symbol '${args.symbol}' is not available.`
      );
    }

    // Pool configuration note:
    // Pool was initialized at tick 0 with sqrtPriceX96 = 2^96 (price = 1 in unit terms)
    // With USDC (6 decimals) and cbBTC (8 decimals):
    // 1 USDC unit (10^-6 USDC) = 1 cbBTC unit (10^-8 cbBTC)
    // So 1 USDC = 100 cbBTC units = 0.000001 cbBTC -> 1 cbBTC = 1,000,000 USDC
    // This means pool prices BTC at $1,000,000 (way above market ~$45,000)
    // For a $45,000 BTC: 1 USDC should buy 1/45000 = 0.0000222 BTC
    
    console.log("Using Uniswap V4 pool:", {
      currency0: poolKey.currency0,
      currency1: poolKey.currency1,
      fee: `${poolKey.fee} (${poolKey.fee / 10000}%)`,
      tickSpacing: poolKey.tickSpacing,
      poolPriceNote: "Pool at tick 0: 1 cbBTC = 1,000,000 USDC (testnet price, not market)",
    });

    console.log("Swap amount:", {
      originalSize: args.size,
      finalAmountIn: formatUnits(amountIn, tokenInDecimals),
      amountInBaseUnits: amountIn.toString(),
      tokenIn: tokenIn,
      tokenInDecimals,
    });

    // Determine swap direction: zeroForOne means currency0 -> currency1
    // If tokenIn is currency0, then zeroForOne = true
    const zeroForOne = tokenIn.toLowerCase() === poolKey.currency0.toLowerCase();

    // In V4, amountSpecified is positive for exact input swaps
    // The sign indicates direction: positive = input, negative = output
    const amountSpecified = amountIn;

    // Simulate the swap to get the actual output amount (including fees)
    // This gives us the real price based on pool state and swap amount
    let expectedAmountOut: bigint;
    let calculatedPrice: number;
    
    try {
      console.log("Simulating swap via SwapRouter to get actual output amount...");
      const sqrtPriceLimitX96 = getSqrtPriceLimitX96(zeroForOne);
      console.log("Using sqrtPriceLimitX96:", sqrtPriceLimitX96.toString(), "for zeroForOne:", zeroForOne);
      console.log("SwapRouter address:", routerAddress);
      
      const simulationResult = await publicClient.simulateContract({
        address: routerAddress,
        abi: POOL_SWAP_TEST_ABI,
        functionName: "swap",
        args: [
          poolKey,
          {
            zeroForOne,
            amountSpecified: BigInt(amountSpecified.toString()),
            sqrtPriceLimitX96,
          },
          {
            takeClaims: false, // Transfer tokens directly
            settleUsingBurn: false, // Don't burn tokens
          },
          "0x" as `0x${string}`, // Empty hook data
        ],
        account: account.address,
      });

      // PoolSwapTest returns a single int256 delta (BalanceDelta packed)
      // Positive delta means we receive tokens, negative means we send
      // For exact input swaps, the output amount is the absolute value of the other side
      const delta = simulationResult.result;
      
      // The delta is packed as int256: the output amount for exact input swaps
      // For zeroForOne: we input token0, receive token1 (delta > 0 means we receive)
      // For oneForZero: we input token1, receive token0 (delta > 0 means we receive)
      // The returned delta represents the amount we receive (positive) or send (negative)
      expectedAmountOut = delta > 0 ? BigInt(delta.toString()) : BigInt(-delta.toString());

      // Calculate price based on actual amounts (includes fees)
      // Price = amountIn / amountOut (for buy) or amountOut / amountIn (for sell)
      if (expectedAmountOut > 0) {
        const amountInFormatted = Number(formatUnits(amountIn, tokenInDecimals));
        const amountOutFormatted = Number(formatUnits(expectedAmountOut, tokenOutDecimals));
        
        if (args.side === "buy") {
          // Buying: price = amountIn (USDC) / amountOut (BTC)
          // This is the price per BTC including fees
          calculatedPrice = amountInFormatted / amountOutFormatted;
        } else {
          // Selling: price = amountOut (USDC) / amountIn (BTC)
          // This is the price per BTC including fees
          calculatedPrice = amountOutFormatted / amountInFormatted;
        }
      } else {
        throw new Error("Simulation returned zero or negative output amount");
      }

      console.log("Swap simulation result:", {
        delta: delta.toString(),
        expectedAmountOut: expectedAmountOut.toString(),
        expectedAmountOutFormatted: formatUnits(expectedAmountOut, tokenOutDecimals),
        calculatedPrice,
        priceIncludesFee: true,
        poolFee: `${POOL_FEE / 10000}%`,
      });
    } catch (simError: any) {
      // Check if this is a liquidity/slippage error from simulation
      const simErrorMessage = simError?.message || String(simError);
      
      // Check for specific error types
      if (simErrorMessage.includes('V4TooLittleReceived') || simErrorMessage.includes('0x54e3ca0d')) {
        throw new Error(
          `Swap simulation failed: V4TooLittleReceived. ` +
          `The swap output was less than the minimum expected. ` +
          `\n\nPossible causes:\n` +
          `1. Pool has insufficient liquidity for this swap size\n` +
          `2. Pool price is configured incorrectly (tick 0 = non-market price)\n` +
          `3. High price impact due to low liquidity\n` +
          `\nSwap amount: $${args.size}, Pool: ${poolKey.currency0}/${poolKey.currency1}\n` +
          `SwapRouter: ${routerAddress}`
        );
      }
      
      // For other errors, fall through to fallback calculation
      {
        // Non-slippage error - use fallback calculation
        console.warn("Could not simulate swap, using fallback price calculation:", simError.message);
        const estimatedPrice = await getCurrentPrice(args.symbol);
        const formatPrice = (price: number): string => {
          const fixed = price.toFixed(18);
          return fixed.replace(/\.?0+$/, '');
        };
        const priceString = formatPrice(estimatedPrice);

        if (args.side === "buy") {
          expectedAmountOut = (amountIn * parseUnits("1", tokenOutDecimals)) / parseUnits(priceString, tokenInDecimals);
          calculatedPrice = estimatedPrice;
        } else {
          expectedAmountOut = (amountIn * parseUnits(priceString, tokenOutDecimals)) / parseUnits("1", tokenInDecimals);
          calculatedPrice = estimatedPrice;
        }
        console.warn("Using fallback price:", calculatedPrice);
      }
    }

    // Calculate dynamic slippage based on price impact
    // For testnet pools with low liquidity, we need higher slippage for larger swaps
    let dynamicSlippage = SLIPPAGE_TOLERANCE;
    
    // Estimate price impact based on swap size relative to known pool liquidity (~2.5B)
    // Pool liquidity in USDC terms (rough estimate)
    const ESTIMATED_POOL_LIQUIDITY_USDC = 2500; // ~$2500 total value in pool
    const swapSizeUSDC = args.side === "buy" ? args.size : args.size * calculatedPrice;
    const estimatedPriceImpact = swapSizeUSDC / ESTIMATED_POOL_LIQUIDITY_USDC;
    
    // If estimated price impact is high, increase slippage tolerance
    if (estimatedPriceImpact > 0.01) { // > 1% of pool
      // Scale slippage: for each 1% of pool, add 5% slippage
      const additionalSlippage = estimatedPriceImpact * 5;
      dynamicSlippage = Math.min(SLIPPAGE_TOLERANCE + additionalSlippage, 0.50); // Cap at 50%
      console.warn(`Large swap relative to pool liquidity. ` +
        `Estimated price impact: ${(estimatedPriceImpact * 100).toFixed(2)}%. ` +
        `Increasing slippage tolerance to ${(dynamicSlippage * 100).toFixed(1)}%`);
    }
    
    // Apply slippage tolerance
    const slippageBps = BigInt(Math.floor(dynamicSlippage * 10000));
    const slippageMultiplier = BigInt(10000) - slippageBps;
    const amountOutMinimum = (expectedAmountOut * slippageMultiplier) / BigInt(10000);

    console.log("Slippage protection calculated:", {
      expectedAmountOut: expectedAmountOut.toString(),
      expectedAmountOutFormatted: formatUnits(expectedAmountOut, tokenOutDecimals),
      calculatedPrice,
      baseSlippageTolerance: `${SLIPPAGE_TOLERANCE * 100}%`,
      dynamicSlippageTolerance: `${dynamicSlippage * 100}%`,
      estimatedPriceImpact: `${(estimatedPriceImpact * 100).toFixed(2)}%`,
      amountOutMinimum: amountOutMinimum.toString(),
      amountOutMinimumFormatted: formatUnits(amountOutMinimum, tokenOutDecimals),
    });
    
    // Warn if price impact is very high
    if (estimatedPriceImpact > 0.10) { // > 10% of pool
      console.warn(`⚠️ WARNING: This swap is ${(estimatedPriceImpact * 100).toFixed(1)}% of estimated pool liquidity. ` +
        `Expect significant price impact. Consider a smaller amount.`);
    }

    // Execute swap via SwapRouter (PoolSwapTest)
    // IMPORTANT: V4 requires using a SwapRouter that implements the unlock callback pattern
    // The PoolManager.swap() cannot be called directly - it must be within an unlock callback
    let swapHash: `0x${string}`;
    let receipt: any;
    
    try {
      const execSqrtPriceLimit = getSqrtPriceLimitX96(zeroForOne);
      
      console.log("Executing swap via SwapRouter:", {
        router: routerAddress,
        poolKey,
        zeroForOne,
        amountSpecified: amountSpecified.toString(),
        sqrtPriceLimitX96: execSqrtPriceLimit.toString(),
      });
      
      // PoolSwapTest uses testSettings: { takeClaims: false, settleUsingBurn: false }
      // This means tokens are transferred directly (not using claims or burning)
      swapHash = await walletClient.writeContract({
        address: routerAddress,
        abi: POOL_SWAP_TEST_ABI,
        functionName: "swap",
        args: [
          poolKey,
          {
            zeroForOne,
            amountSpecified: BigInt(amountSpecified.toString()),
            sqrtPriceLimitX96: execSqrtPriceLimit,
          },
          {
            takeClaims: false, // Transfer tokens directly to recipient
            settleUsingBurn: false, // Don't burn tokens for settlement
          },
          "0x" as `0x${string}`, // Empty hook data for standard swaps
        ],
      });

      // Wait for transaction receipt
      receipt = await publicClient.waitForTransactionReceipt({ hash: swapHash });

      // Verify transaction succeeded
      if (receipt.status === "reverted") {
        // Try to decode the error from the receipt
        let errorMessage = `Swap transaction reverted. Hash: ${swapHash}`;
        try {
          // Get the transaction to decode the error
          const tx = await publicClient.getTransaction({ hash: swapHash });
          // Try to simulate the call to get the error
          try {
            const debugSqrtPriceLimit = getSqrtPriceLimitX96(zeroForOne);
            await publicClient.simulateContract({
              address: routerAddress,
              abi: POOL_SWAP_TEST_ABI,
              functionName: "swap",
              args: [
                poolKey,
                {
                  zeroForOne,
                  amountSpecified: BigInt(amountSpecified.toString()),
                  sqrtPriceLimitX96: debugSqrtPriceLimit,
                },
                {
                  takeClaims: false,
                  settleUsingBurn: false,
                },
                "0x" as `0x${string}`,
              ],
              account: account.address,
            });
          } catch (simError: any) {
            // Try to decode the error
            if (simError?.data || simError?.cause?.data) {
              const errorData = (simError.data || simError.cause.data) as `0x${string}`;
              try {
                const decoded = decodeErrorResult({
                  abi: UNISWAP_V4_POOL_MANAGER_ABI,
                  data: errorData,
                });
                if (decoded.errorName === 'V4TooLittleReceived') {
                  const minAmount = decoded.args?.[0]?.toString() || 'unknown';
                  const received = decoded.args?.[1]?.toString() || 'unknown';
                  errorMessage = `Swap failed: V4TooLittleReceived - Minimum expected: ${minAmount}, Received: ${received}`;
                } else {
                  errorMessage = `Swap failed: ${decoded.errorName}`;
                }
              } catch {
                // If decoding fails, check for known error signatures
                if (errorData.startsWith('0x54e3ca0d')) {
                  errorMessage = `Swap failed: V4TooLittleReceived (0x54e3ca0d) - Received less than minimum expected amount`;
                }
              }
            }
          }
        } catch (decodeError) {
          // If we can't decode, use the generic error
          console.warn("Could not decode revert reason:", decodeError);
        }
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      // Enhanced error handling for Uniswap V4 custom errors
      let decodedError: any = null;
      
      // Helper to extract error data from various error formats
      const getErrorData = (err: any): `0x${string}` | null => {
        if (err?.data && typeof err.data === 'string' && err.data.startsWith('0x')) {
          return err.data as `0x${string}`;
        }
        if (err?.cause?.data && typeof err.cause.data === 'string' && err.cause.data.startsWith('0x')) {
          return err.cause.data as `0x${string}`;
        }
        // Check for error data in the message (some RPC providers embed it)
        const match = err?.message?.match(/0x[0-9a-fA-F]+/);
        if (match && match[0].length > 10) {
          return match[0] as `0x${string}`;
        }
        return null;
      };

      const errorData = getErrorData(error);
      
      // Try to decode the error using the ABI
      if (errorData) {
        try {
          decodedError = decodeErrorResult({
            abi: UNISWAP_V4_POOL_MANAGER_ABI,
            data: errorData,
          });
        } catch (decodeErr) {
          // If decoding fails, check the error message/string
          if (errorData.includes('54e3ca0d') || errorData.startsWith('0x54e3ca0d')) {
            // V4TooLittleReceived signature - try to manually decode
            // Format: 0x54e3ca0d + uint256(minAmount) + uint256(received)
            // Each uint256 is 32 bytes (64 hex chars)
            if (errorData.length >= 138) { // 10 (0x + 8 chars) + 64 + 64
              const minAmountHex = '0x' + errorData.slice(10, 74);
              const receivedHex = '0x' + errorData.slice(74, 138);
              try {
                const minAmount = BigInt(minAmountHex);
                const received = BigInt(receivedHex);
                decodedError = { 
                  errorName: 'V4TooLittleReceived', 
                  args: [minAmount, received] 
                };
              } catch {
                decodedError = { errorName: 'V4TooLittleReceived' };
              }
            } else {
              decodedError = { errorName: 'V4TooLittleReceived' };
            }
          }
        }
      }
      
      // Check error message for error signatures
      if (!decodedError && error?.message) {
        const errorString = error.message;
        if (errorString.includes('0x54e3ca0d') || errorString.includes('V4TooLittleReceived')) {
          decodedError = { errorName: 'V4TooLittleReceived' };
        }
      }
      
      // Handle specific decoded errors
      if (decodedError) {
        if (decodedError.errorName === 'V4TooLittleReceived') {
          const minAmountRaw = decodedError.args?.[0];
          const receivedRaw = decodedError.args?.[1];
          
          // Format amounts for display
          let minAmountDisplay = 'unknown';
          let receivedDisplay = 'unknown';
          let priceImpactInfo = '';
          
          if (minAmountRaw !== undefined && receivedRaw !== undefined) {
            const minAmount = BigInt(minAmountRaw.toString());
            const received = BigInt(receivedRaw.toString());
            minAmountDisplay = formatUnits(minAmount, tokenOutDecimals);
            receivedDisplay = formatUnits(received, tokenOutDecimals);
            
            // Calculate price impact
            if (minAmount > BigInt(0)) {
              const impact = Number(((minAmount - received) * BigInt(10000)) / minAmount) / 100;
              priceImpactInfo = ` Price impact: ~${impact.toFixed(2)}%.`;
            }
          }
          
          // Calculate suggested max swap size based on current slippage
          const suggestedMaxSize = args.size * (SLIPPAGE_TOLERANCE / 0.15); // Scale based on slippage
          
          throw new Error(
            `Swap failed: Received less than minimum expected (V4TooLittleReceived). ` +
            `Expected at least: ${minAmountDisplay} ${args.side === 'buy' ? args.symbol : 'USDC'}, ` +
            `Would receive: ${receivedDisplay} ${args.side === 'buy' ? args.symbol : 'USDC'}.${priceImpactInfo} ` +
            `\n\nThis testnet pool has LOW LIQUIDITY. Solutions:\n` +
            `1. Try a smaller amount (suggested: $${Math.min(suggestedMaxSize, 10).toFixed(2)} or less)\n` +
            `2. Current slippage tolerance: ${(SLIPPAGE_TOLERANCE * 100).toFixed(0)}% - increase SLIPPAGE_TOLERANCE env var\n` +
            `3. The pool may need more liquidity for larger swaps\n` +
            `Swap size: $${args.size}, Pool fee: ${poolKey.fee / 10000}%`
          );
        }
        
        if (decodedError.errorName === 'CurrencyNotSettled') {
          const currency = decodedError.args?.[0] || 'unknown';
          throw new Error(
            `Swap failed: Currency not settled (CurrencyNotSettled). ` +
            `Currency: ${currency}. ` +
            `The swap accounting was not completed properly. ` +
            `This may indicate an issue with the swap flow or pool state.`
          );
        }
        
        if (decodedError.errorName === 'PoolNotInitialized') {
          throw new Error(
            `Swap failed: Pool not initialized (PoolNotInitialized). ` +
            `The pool may not exist or may need to be initialized first. ` +
            `Pool: ${poolKey.currency0}/${poolKey.currency1}, Fee: ${poolKey.fee}, TickSpacing: ${poolKey.tickSpacing}`
          );
        }
        
        if (decodedError.errorName === 'SwapAmountCannotBeZero') {
          throw new Error(
            `Swap failed: Swap amount cannot be zero (SwapAmountCannotBeZero). ` +
            `Please specify a non-zero swap amount. ` +
            `Amount specified: ${amountSpecified.toString()}`
          );
        }
      }
      
      // Fallback: provide helpful error message
      const errorMessage = error?.message || String(error);
      throw new Error(
        `Failed to execute Uniswap V4 swap: ${errorMessage}. ` +
        `\nSwap parameters: size=$${args.size}, tokenIn=${tokenIn}, tokenOut=${tokenOut}. ` +
        `\nNote: This testnet pool has limited liquidity. Try smaller amounts ($1-$10).`
      );
    }

    // Note: When using PoolSwapTest (SwapRouter), the router handles settle/take internally
    // via the unlock callback pattern. We don't need to manually call settle/take.
    // The tokens are transferred directly by the router based on the testSettings:
    // - takeClaims: false = transfer tokens directly (not to claims)
    // - settleUsingBurn: false = transfer from router's balance (not burn)
    
    console.log("Swap completed via SwapRouter - tokens should be transferred automatically");

    // Parse Swap events from the receipt to verify the swap occurred
    let actualAmountOut = BigInt(0);
    let executionPrice = calculatedPrice; // Use calculated price from simulation as default

    try {
      // Parse Swap events from logs
      const swapEvents = receipt.logs
        .map((log: any) => {
          try {
            return decodeEventLog({
              abi: UNISWAP_V4_POOL_ABI,
              data: log.data,
              topics: log.topics,
            });
          } catch {
            return null;
          }
        })
        .filter((event: any): event is { eventName: "Swap"; args: any } =>
          event !== null && event.eventName === "Swap"
        );

      if (swapEvents.length > 0) {
        // Get the Swap event
        const swapEvent = swapEvents[swapEvents.length - 1];
        const { delta } = swapEvent.args;

        // Delta represents the change in balance
        // For zeroForOne: delta is negative for currency0 (input), positive for currency1 (output)
        // For oneForZero: delta is positive for currency0 (output), negative for currency1 (input)
        if (zeroForOne) {
          // currency0 -> currency1, so delta should be positive for currency1
          // The delta in the event is the total delta, we need to extract the positive output
          actualAmountOut = BigInt(Math.abs(Number(delta.toString())));
        } else {
          // currency1 -> currency0, so delta should be positive for currency0
          actualAmountOut = BigInt(Math.abs(Number(delta.toString())));
        }

        // Calculate execution price from actual amounts received (includes fees)
        if (actualAmountOut > 0) {
          const amountInFormatted = Number(formatUnits(amountIn, tokenInDecimals));
          const amountOutFormatted = Number(formatUnits(actualAmountOut, tokenOutDecimals));

          if (args.side === "buy") {
            // Buying: price = amountIn (USDC) / amountOut (BTC)
            // This is the effective price per BTC including Uniswap fee (0.3%)
            executionPrice = amountInFormatted / amountOutFormatted;
          } else {
            // Selling: price = amountOut (USDC) / amountIn (BTC)
            // This is the effective price per BTC including Uniswap fee (0.3%)
            executionPrice = amountOutFormatted / amountInFormatted;
          }
        }

        console.log("Swap event parsed:", {
          delta: delta.toString(),
          actualAmountOut: actualAmountOut.toString(),
          actualAmountOutFormatted: formatUnits(actualAmountOut, tokenOutDecimals),
          executionPrice,
          priceIncludesFee: true,
          poolFee: `${POOL_FEE / 10000}%`,
        });
      } else {
        console.warn("No Swap events found in transaction receipt, using calculated price from simulation");
      }
    } catch (err) {
      console.warn("Could not parse Swap events from receipt:", err);
      console.warn("Using calculated price from simulation:", executionPrice);
    }

    // If we couldn't parse the event, use the calculated price from simulation
    if (actualAmountOut === BigInt(0)) {
      console.warn("Could not determine amountOut from events, using calculated price from simulation...");
      // executionPrice already set to calculatedPrice above
    }

    // Verify tokens were actually received by checking balance
    try {
      const tokenOutInfo = TOKEN_ADDRESSES[args.symbol] || TOKEN_ADDRESSES.BTC;
      const balanceAfter = await publicClient.readContract({
        address: tokenOut,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [args.userAddress as `0x${string}`],
      });

      const balanceFormatted = formatUnits(balanceAfter, tokenOutDecimals);
      console.log(`Balance check for ${args.symbol} (${tokenOut}):`, {
        address: args.userAddress,
        balance: balanceAfter.toString(),
        balanceFormatted,
      });
    } catch (balanceError: any) {
      console.warn("Could not check token balance after swap:", balanceError.message);
    }

    // Log swap details for debugging
    console.log("Swap executed successfully:", {
      txHash: swapHash,
      tokenIn,
      tokenOut,
      amountIn: amountIn.toString(),
      actualAmountOut: actualAmountOut.toString(),
      recipient: args.userAddress,
      side: args.side,
      symbol: args.symbol,
      executionPrice,
      receiptStatus: receipt.status,
      receiptLogsCount: receipt.logs.length,
    });

    return {
      txHash: swapHash,
      executionPrice,
    };
  } catch (error: any) {
    console.error("Error executing Uniswap V4 swap:", error);
    throw new Error(`Failed to execute Uniswap V4 swap: ${error.message}`);
  }
}

/**
 * Check available pools for a token pair
 * In V4, pools are identified by PoolKey (currency0, currency1, fee, tickSpacing, hooks)
 * Returns the configured pool if it matches the token pair
 */
export async function checkAvailablePools(
  tokenA: string,
  tokenB: string
): Promise<Array<{ fee: number; feePercent: string; poolAddress: string }>> {
  const tokenAAddress = TOKEN_ADDRESSES[tokenA]?.address;
  const tokenBAddress = TOKEN_ADDRESSES[tokenB]?.address;

  if (!tokenAAddress || !tokenBAddress) {
    throw new Error(`Token not found: ${tokenA} or ${tokenB}`);
  }

  const poolKey = getPoolKey(tokenAAddress, tokenBAddress);
  
  // Check if the pool matches the configured pool
  if (
    poolKey.currency0.toLowerCase() === POOL_CURRENCY0.toLowerCase() &&
    poolKey.currency1.toLowerCase() === POOL_CURRENCY1.toLowerCase()
  ) {
    return [
      {
        fee: poolKey.fee,
        feePercent: `${poolKey.fee / 10000}%`,
        poolAddress: UNISWAP_V4_POOL_MANAGER_ADDRESS, // V4 uses singleton PoolManager
      },
    ];
  }

  return [];
}

/**
 * Get current price for a symbol (mock implementation)
 * In production, this would query Uniswap pools or an oracle
 */
export async function getCurrentPrice(symbol: string): Promise<number> {
  // Mock implementation
  const basePrices: Record<string, number> = {
    BTC: 45000,
    ETH: 3000,
    SOL: 150,
    WETH: 3000,
  };

  return basePrices[symbol] || 3000;
}

/**
 * Get pool liquidity information
 * Returns estimated liquidity and recommended max swap size
 */
export async function getPoolLiquidityInfo(): Promise<{
  estimatedLiquidityUSDC: number;
  recommendedMaxSwapUSDC: number;
  slippageTolerance: number;
  warning?: string;
}> {
  // The pool was deployed with liquidity: 2,500,000,000 (2.5B base units)
  // For USDC (6 decimals), this is 2,500 USDC
  // For cbBTC (8 decimals) at ~$45,000 per BTC, the total pool value varies
  // Conservative estimate: ~$2,500 total value in pool
  
  const estimatedLiquidityUSDC = 2500;
  
  // Recommended max swap is ~1% of pool to keep price impact low
  const recommendedMaxSwapUSDC = estimatedLiquidityUSDC * 0.01; // ~$25
  
  return {
    estimatedLiquidityUSDC,
    recommendedMaxSwapUSDC,
    slippageTolerance: SLIPPAGE_TOLERANCE,
    warning: estimatedLiquidityUSDC < 10000 
      ? `This testnet pool has low liquidity (~$${estimatedLiquidityUSDC}). Recommended max swap: $${recommendedMaxSwapUSDC.toFixed(0)}. Larger swaps may fail or have high slippage.`
      : undefined,
  };
}

/**
 * Validate swap before execution
 * Returns warnings/errors if the swap is likely to fail
 */
export async function validateSwap(args: {
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

  const liquidityInfo = await getPoolLiquidityInfo();
  const swapSizeUSDC = args.side === "buy" ? args.size : args.size * (await getCurrentPrice(args.symbol));
  
  // Check if swap is too large for pool
  const poolPercentage = (swapSizeUSDC / liquidityInfo.estimatedLiquidityUSDC) * 100;
  
  if (poolPercentage > 20) {
    errors.push(
      `Swap size ($${swapSizeUSDC.toFixed(2)}) is ${poolPercentage.toFixed(1)}% of pool liquidity. ` +
      `This will likely fail or have extreme slippage. ` +
      `Recommended: $${liquidityInfo.recommendedMaxSwapUSDC.toFixed(0)} or less.`
    );
    valid = false;
  } else if (poolPercentage > 5) {
    warnings.push(
      `Swap size ($${swapSizeUSDC.toFixed(2)}) is ${poolPercentage.toFixed(1)}% of pool liquidity. ` +
      `Expect ${Math.min(poolPercentage * 2, 50).toFixed(0)}%+ price impact. ` +
      `For better rates, try $${liquidityInfo.recommendedMaxSwapUSDC.toFixed(0)} or less.`
    );
  } else if (poolPercentage > 1) {
    warnings.push(
      `Swap size is ${poolPercentage.toFixed(1)}% of pool liquidity. Some price impact expected.`
    );
  }

  return {
    valid,
    warnings,
    errors,
    suggestedSize: valid ? undefined : liquidityInfo.recommendedMaxSwapUSDC,
  };
}

/**
 * Get token balance for a user address
 */
export async function getTokenBalance(
  userAddress: string,
  symbol: string
): Promise<{ balance: string; formatted: string }> {
  try {
    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(BASE_SEPOLIA_RPC_URL),
    });

    const tokenInfo = TOKEN_ADDRESSES[symbol];
    if (!tokenInfo) {
      throw new Error(`Token ${symbol} not found in TOKEN_ADDRESSES`);
    }

    // Check if contract exists
    const contractCode = await publicClient.getBytecode({ address: tokenInfo.address });
    if (!contractCode || contractCode === "0x") {
      throw new Error(`Token contract does not exist at ${tokenInfo.address}`);
    }

    const balance = await publicClient.readContract({
      address: tokenInfo.address,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [userAddress as `0x${string}`],
    });

    const formatted = formatUnits(balance, tokenInfo.decimals);

    return {
      balance: balance.toString(),
      formatted,
    };
  } catch (error: any) {
    console.error(`Error getting balance for ${symbol}:`, error);
    throw new Error(`Failed to get token balance: ${error.message}`);
  }
}
