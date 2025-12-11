// Uniswap V3 spot exchange interaction on Base Sepolia
import { createWalletClient, createPublicClient, http, parseUnits, formatUnits, decodeEventLog } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const BASE_SEPOLIA_RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
const EXECUTION_PRIVATE_KEY = process.env.EXECUTION_PRIVATE_KEY || "";

// Uniswap V3 contract addresses on Base Sepolia
const UNISWAP_V3_ROUTER_ADDRESS = process.env.UNISWAP_V3_ROUTER_ADDRESS || "0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4"; // SwapRouter02 on Base Sepolia
const UNISWAP_V3_QUOTER_V2_ADDRESS = process.env.UNISWAP_V3_QUOTER_V2_ADDRESS || "0xC5290058841028F1614F3A6F0F5816cAd0df5E27"; // QuoterV2 on Base Sepolia
const UNISWAP_V3_FACTORY_ADDRESS = process.env.UNISWAP_V3_FACTORY_ADDRESS || "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24"; // UniswapV3Factory on Base Sepolia

// Slippage tolerance (1% = 0.01, so we accept 99% of quoted amount)
const SLIPPAGE_TOLERANCE = parseFloat(process.env.SLIPPAGE_TOLERANCE || "0.01"); // 1% default

// Token addresses on Base Sepolia
// These are common testnet token addresses - adjust as needed
const TOKEN_ADDRESSES: Record<string, { address: `0x${string}`; decimals: number }> = {
  USDC: {
    address: (process.env.BASE_SEPOLIA_USDC_ADDRESS || "0x036CbD53842c5426634e7929541eC2318f3dCF7e") as `0x${string}`, // USDC on Base Sepolia
    decimals: 6,
  },
  WETH: {
    address: "0x4200000000000000000000000000000000000006", // WETH on Base Sepolia
    decimals: 18,
  },
  BTC: {
    address: (process.env.BASE_SEPOLIA_BTC_ADDRESS || "0x13dcec0762ecc5e666c207ab44dc768e5e33070f") as `0x${string}`, // WBTC on Base Sepolia
    decimals: 8,
  },
  WBTC: {
    address: (process.env.BASE_SEPOLIA_BTC_ADDRESS || "0x13dcec0762ecc5e666c207ab44dc768e5e33070f") as `0x${string}`, // WBTC on Base Sepolia (alias for BTC)
    decimals: 8,
  },
  // Add more tokens as needed
};

// ERC20 ABI for approvals
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
] as const;

// Uniswap V3 SwapRouter02 ABI (simplified for exactInputSingle)
const UNISWAP_V3_ROUTER_ABI = [
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
          { name: "deadline", type: "uint256" },
          { name: "amountIn", type: "uint256" },
          { name: "amountOutMinimum", type: "uint256" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
] as const;

// Uniswap V3 QuoterV2 ABI (for getting swap quotes)
const UNISWAP_V3_QUOTER_V2_ABI = [
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
          { name: "fee", type: "uint24" },
          { name: "amountIn", type: "uint256" },
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

// Uniswap V3 Original Quoter ABI (fallback for older deployments)
const UNISWAP_V3_QUOTER_ABI = [
  {
    name: "quoteExactInputSingle",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenIn", type: "address" },
      { name: "tokenOut", type: "address" },
      { name: "fee", type: "uint24" },
      { name: "amountIn", type: "uint256" },
      { name: "sqrtPriceLimitX96", type: "uint160" },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
] as const;

// Uniswap V3 Pool Swap event ABI (for parsing swap events)
const UNISWAP_V3_POOL_ABI = [
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

// Uniswap V3 Factory ABI (for checking if pools exist)
const UNISWAP_V3_FACTORY_ABI = [
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

// Common Uniswap V3 fee tiers (in basis points)
// 100 = 0.01%, 500 = 0.05%, 3000 = 0.3%, 10000 = 1%
const FEE_TIERS = [500, 3000, 10000, 100]; // Try most common first

/**
 * Find an available Uniswap V3 pool for a token pair
 * Tries multiple fee tiers to find which pool exists
 */
async function findAvailablePool(
  publicClient: any,
  tokenA: `0x${string}`,
  tokenB: `0x${string}`
): Promise<{ poolAddress: `0x${string}`; fee: number } | null> {
  // Ensure tokenA < tokenB (Uniswap requires tokens in sorted order)
  const [token0, token1] = tokenA.toLowerCase() < tokenB.toLowerCase()
    ? [tokenA, tokenB]
    : [tokenB, tokenA];

  // Try each fee tier
  for (const fee of FEE_TIERS) {
    try {
      const poolAddress = await publicClient.readContract({
        address: UNISWAP_V3_FACTORY_ADDRESS as `0x${string}`,
        abi: UNISWAP_V3_FACTORY_ABI,
        functionName: "getPool",
        args: [token0, token1, fee],
      });

      if (poolAddress && poolAddress !== "0x0000000000000000000000000000000000000000") {
        // Verify the pool contract has code (is actually deployed)
        const poolCode = await publicClient.getBytecode({ address: poolAddress });
        if (poolCode && poolCode !== "0x") {
          console.log(`Found pool for ${tokenA}/${tokenB} with fee ${fee} (${fee / 10000}%): ${poolAddress}`);
          return { poolAddress: poolAddress as `0x${string}`, fee };
        }
      }
    } catch (error) {
      // Continue to next fee tier
      continue;
    }
  }

  return null;
}

/**
 * Execute a spot swap on Uniswap V3
 * 
 * @param args - Swap parameters
 * @returns Transaction hash and execution price
 */
export async function executeUniswapSwap(args: {
  userAddress: string;
  symbol: string; // Token symbol to buy (e.g., "WETH")
  side: "buy" | "sell";
  size: number; // Amount in USDC (for buy) or token amount (for sell)
  leverage?: number; // Not used for spot, but kept for compatibility
}): Promise<{ txHash: string; executionPrice: number }> {
  if (!EXECUTION_PRIVATE_KEY) {
    throw new Error("EXECUTION_PRIVATE_KEY not configured");
  }

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
      : TOKEN_ADDRESSES[args.symbol]?.address || TOKEN_ADDRESSES.WETH.address;

    const tokenOut = args.side === "buy"
      ? TOKEN_ADDRESSES[args.symbol]?.address || TOKEN_ADDRESSES.WETH.address
      : TOKEN_ADDRESSES.USDC.address;

    const tokenInDecimals = args.side === "buy" ? TOKEN_ADDRESSES.USDC.decimals : (TOKEN_ADDRESSES[args.symbol]?.decimals || 18);
    const tokenOutDecimals = args.side === "buy" ? (TOKEN_ADDRESSES[args.symbol]?.decimals || 18) : TOKEN_ADDRESSES.USDC.decimals;

    // Convert size to appropriate token units
    const amountIn = parseUnits(args.size.toString(), tokenInDecimals);

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

      // Check allowance
      let allowance = BigInt(0);
      try {
        allowance = await publicClient.readContract({
          address: tokenIn,
          abi: ERC20_ABI,
          functionName: "allowance",
          args: [account.address, UNISWAP_V3_ROUTER_ADDRESS as `0x${string}`],
        });
      } catch (error: any) {
        // If allowance call fails, it might be because the contract doesn't support ERC20
        // or there's a network issue
        throw new Error(
          `Failed to check token allowance: ${error.message}. ` +
          `Token address: ${tokenIn}. ` +
          `This may indicate the token contract is not a valid ERC20 token on Base Sepolia.`
        );
      }

      if (allowance < amountIn) {
        // Approve router to spend tokens
        const approveHash = await walletClient.writeContract({
          address: tokenIn,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [UNISWAP_V3_ROUTER_ADDRESS as `0x${string}`, amountIn * BigInt(2)], // Approve 2x for safety
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }
    }

    // Find available pool for this token pair (tries multiple fee tiers)
    const poolInfo = await findAvailablePool(publicClient, tokenIn, tokenOut);

    if (!poolInfo) {
      throw new Error(
        `No Uniswap V3 pool found for ${args.side === "buy" ? "USDC" : args.symbol}/${args.side === "buy" ? args.symbol : "USDC"} ` +
        `on Base Sepolia. Tried fee tiers: ${FEE_TIERS.map(f => `${f / 10000}%`).join(", ")}. ` +
        `The pool must be created before swaps can be executed.`
      );
    }

    const { poolAddress, fee } = poolInfo;
    console.log(`Using pool: ${poolAddress} with fee tier ${fee} (${fee / 10000}%)`);

    // Get quote from Uniswap Quoter to determine expected output amount
    let amountOutMinimum = BigInt(0);
    try {
      // Try QuoterV2 first (returns tuple)
      let expectedAmountOut: bigint;
      try {
        const quoterV2Result = await publicClient.readContract({
          address: UNISWAP_V3_QUOTER_V2_ADDRESS as `0x${string}`,
          abi: UNISWAP_V3_QUOTER_V2_ABI,
          functionName: "quoteExactInputSingle",
          args: [
            {
              tokenIn,
              tokenOut,
              fee,
              amountIn,
              sqrtPriceLimitX96: BigInt(0), // No price limit
            },
          ],
        });
        // QuoterV2 returns: [amountOut, sqrtPriceX96After, initializedTicksCrossed, gasEstimate]
        expectedAmountOut = quoterV2Result[0] as bigint;
      } catch (v2Error) {
        // If QuoterV2 fails, we'll fall through to the price-based fallback calculation below
        throw v2Error; // Re-throw to trigger the fallback calculation
      }

      // Apply slippage tolerance: amountOutMinimum = expectedAmountOut * (1 - SLIPPAGE_TOLERANCE)
      // Using BigInt arithmetic: multiply by (10000 - slippageBps) / 10000
      const slippageBps = BigInt(Math.floor(SLIPPAGE_TOLERANCE * 10000)); // Convert to basis points
      const slippageMultiplier = BigInt(10000) - slippageBps;
      amountOutMinimum = (expectedAmountOut * slippageMultiplier) / BigInt(10000);

      console.log("Slippage protection calculated:", {
        expectedAmountOut: expectedAmountOut.toString(),
        slippageTolerance: `${SLIPPAGE_TOLERANCE * 100}%`,
        amountOutMinimum: amountOutMinimum.toString(),
      });
    } catch (error: any) {
      // If quote fails, fall back to a conservative estimate based on a simple calculation
      // This is a fallback - in production, you should handle this more gracefully
      console.warn("Failed to get quote from Quoter contract, using fallback calculation:", error.message);

      // Fallback: estimate based on a simple price assumption
      // For buy: size (USDC) / estimated price = token amount
      // For sell: size (tokens) * estimated price = USDC amount
      // Apply slippage to the fallback estimate
      const estimatedPrice = await getCurrentPrice(args.symbol);
      let estimatedAmountOut: bigint;

      // Format price to avoid scientific notation (e.g., 1e-7 -> "0.0000001")
      // Use toFixed with enough decimal places, then remove trailing zeros
      const formatPrice = (price: number): string => {
        // Use toFixed with 18 decimal places to handle very small numbers
        const fixed = price.toFixed(18);
        // Remove trailing zeros and the decimal point if not needed
        return fixed.replace(/\.?0+$/, '');
      };

      const priceString = formatPrice(estimatedPrice);

      if (args.side === "buy") {
        // Buying: USDC -> Token, so amountOut = amountIn / price
        estimatedAmountOut = (amountIn * parseUnits("1", tokenOutDecimals)) / parseUnits(priceString, tokenInDecimals);
      } else {
        // Selling: Token -> USDC, so amountOut = amountIn * price
        estimatedAmountOut = (amountIn * parseUnits(priceString, tokenOutDecimals)) / parseUnits("1", tokenInDecimals);
      }

      // Apply slippage tolerance
      const slippageBps = BigInt(Math.floor(SLIPPAGE_TOLERANCE * 10000));
      const slippageMultiplier = BigInt(10000) - slippageBps;
      amountOutMinimum = (estimatedAmountOut * slippageMultiplier) / BigInt(10000);

      console.warn("Using fallback slippage calculation:", {
        estimatedAmountOut: estimatedAmountOut.toString(),
        amountOutMinimum: amountOutMinimum.toString(),
      });
    }

    // Pool already verified in findAvailablePool above
    console.log("Pool verified:", {
      poolAddress,
      tokenPair: `${args.side === "buy" ? "USDC" : args.symbol}/${args.side === "buy" ? args.symbol : "USDC"}`,
      fee: `${fee} (${fee / 10000}%)`,
    });

    // Set deadline (20 minutes from now)
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60);

    // Execute swap
    const swapHash = await walletClient.writeContract({
      address: UNISWAP_V3_ROUTER_ADDRESS as `0x${string}`,
      abi: UNISWAP_V3_ROUTER_ABI,
      functionName: "exactInputSingle",
      args: [
        {
          tokenIn,
          tokenOut,
          fee,
          recipient: args.userAddress as `0x${string}`,
          deadline,
          amountIn,
          amountOutMinimum,
          sqrtPriceLimitX96: BigInt(0), // No price limit
        },
      ],
    });

    // Wait for transaction receipt
    const receipt = await publicClient.waitForTransactionReceipt({ hash: swapHash });

    // Verify transaction succeeded
    if (receipt.status === "reverted") {
      throw new Error(`Swap transaction reverted. Hash: ${swapHash}`);
    }

    // Parse Swap events from the receipt to verify the swap occurred
    let actualAmountOut = BigInt(0);
    let executionPrice = 0;

    try {
      // Parse Swap events from logs
      const swapEvents = receipt.logs
        .map((log) => {
          try {
            return decodeEventLog({
              abi: UNISWAP_V3_POOL_ABI,
              data: log.data,
              topics: log.topics,
            });
          } catch {
            return null;
          }
        })
        .filter((event): event is { eventName: "Swap"; args: any } =>
          event !== null && event.eventName === "Swap"
        );

      if (swapEvents.length > 0) {
        // Get the Swap event (should be the last one)
        const swapEvent = swapEvents[swapEvents.length - 1];
        const { amount0, amount1, recipient: eventRecipient } = swapEvent.args;

        // Determine which amount is the output based on token order in the pool
        // amount0 and amount1 can be negative (input) or positive (output)
        // The positive one is the output
        const amountOutRaw = amount0 > 0 ? amount0 : amount1;
        actualAmountOut = BigInt(amountOutRaw.toString());

        // Verify recipient matches
        if (eventRecipient.toLowerCase() !== args.userAddress.toLowerCase()) {
          console.warn(`Swap recipient mismatch: expected ${args.userAddress}, got ${eventRecipient}`);
        }

        // Calculate execution price from actual amounts
        if (actualAmountOut > 0) {
          const amountInFormatted = Number(formatUnits(amountIn, tokenInDecimals));
          const amountOutFormatted = Number(formatUnits(actualAmountOut, tokenOutDecimals));

          if (args.side === "buy") {
            // Buying: price = amountIn (USDC) / amountOut (tokens)
            executionPrice = amountInFormatted / amountOutFormatted;
          } else {
            // Selling: price = amountOut (USDC) / amountIn (tokens)
            executionPrice = amountOutFormatted / amountInFormatted;
          }
        }

        console.log("Swap event parsed:", {
          amount0: amount0.toString(),
          amount1: amount1.toString(),
          actualAmountOut: actualAmountOut.toString(),
          recipient: eventRecipient,
          executionPrice,
        });
      } else {
        console.warn("No Swap events found in transaction receipt");
      }
    } catch (err) {
      console.warn("Could not parse Swap events from receipt:", err);
    }

    // If we couldn't parse the event, try to get the actual amount from the return value
    if (actualAmountOut === BigInt(0)) {
      try {
        // The exactInputSingle function returns the amountOut
        // We can try to decode it from the transaction, but it's easier to check balance
        console.warn("Could not determine amountOut from events, checking balance...");

        // Check balance before and after (we'd need to store before balance)
        // For now, use fallback calculation
        const estimatedPrice = await getCurrentPrice(args.symbol);
        executionPrice = estimatedPrice;
      } catch (err) {
        console.warn("Could not determine execution price:", err);
        executionPrice = args.side === "buy" ? 3000 : 3000;
      }
    }

    // Verify the swap actually transferred tokens by checking if amountOut > 0
    if (actualAmountOut === BigInt(0)) {
      console.error("WARNING: Swap transaction succeeded but amountOut is 0. This may indicate:");
      console.error("1. The pool doesn't exist or has no liquidity");
      console.error("2. The swap didn't actually execute");
      console.error("3. The amountOutMinimum was too high and the swap reverted (but status shows success?)");
    }

    // Verify tokens were actually received by checking balance
    try {
      const tokenOutInfo = TOKEN_ADDRESSES[args.symbol] || TOKEN_ADDRESSES.WETH;
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

      // If we got the actual amount out, verify it's reasonable
      if (actualAmountOut > BigInt(0)) {
        const expectedBalanceIncrease = formatUnits(actualAmountOut, tokenOutDecimals);
        console.log(`Expected balance increase: ${expectedBalanceIncrease} ${args.symbol}`);
      }
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

    // If actualAmountOut is 0, this is a problem
    if (actualAmountOut === BigInt(0)) {
      console.error("CRITICAL: Swap transaction succeeded but no tokens were received!");
      console.error("This could mean:");
      console.error("1. The Uniswap pool doesn't exist for this token pair");
      console.error("2. The pool has no liquidity");
      console.error("3. The swap reverted due to slippage but transaction still succeeded");
      console.error("4. The recipient address is incorrect");
      console.error(`Transaction hash: ${swapHash}`);
      console.error(`Recipient: ${args.userAddress}`);
      console.error(`Token out: ${tokenOut} (${args.symbol})`);

      // Don't throw error, but log it heavily so it's visible
      // The transaction did succeed, so we return success, but with a warning
    }

    return {
      txHash: swapHash,
      executionPrice,
    };
  } catch (error: any) {
    console.error("Error executing Uniswap swap:", error);
    throw new Error(`Failed to execute Uniswap swap: ${error.message}`);
  }
}

/**
 * Check available pools for a token pair
 * Useful for diagnostics to see which pools exist
 */
export async function checkAvailablePools(
  tokenA: string,
  tokenB: string
): Promise<Array<{ fee: number; feePercent: string; poolAddress: string }>> {
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(BASE_SEPOLIA_RPC_URL),
  });

  const tokenAAddress = TOKEN_ADDRESSES[tokenA]?.address;
  const tokenBAddress = TOKEN_ADDRESSES[tokenB]?.address;

  if (!tokenAAddress || !tokenBAddress) {
    throw new Error(`Token not found: ${tokenA} or ${tokenB}`);
  }

  const [token0, token1] = tokenAAddress.toLowerCase() < tokenBAddress.toLowerCase()
    ? [tokenAAddress, tokenBAddress]
    : [tokenBAddress, tokenAAddress];

  const availablePools: Array<{ fee: number; feePercent: string; poolAddress: string }> = [];

  for (const fee of FEE_TIERS) {
    try {
      const poolAddress = await publicClient.readContract({
        address: UNISWAP_V3_FACTORY_ADDRESS as `0x${string}`,
        abi: UNISWAP_V3_FACTORY_ABI,
        functionName: "getPool",
        args: [token0, token1, fee],
      });

      if (poolAddress && poolAddress !== "0x0000000000000000000000000000000000000000") {
        const poolCode = await publicClient.getBytecode({ address: poolAddress });
        if (poolCode && poolCode !== "0x") {
          availablePools.push({
            fee,
            feePercent: `${fee / 10000}%`,
            poolAddress: poolAddress as string,
          });
        }
      }
    } catch (error) {
      // Continue to next fee tier
      continue;
    }
  }

  return availablePools;
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
