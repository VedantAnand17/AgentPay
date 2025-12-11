// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../src/interfaces/INonfungiblePositionManager.sol";
import "../src/interfaces/IUniswapV3Pool.sol";

/**
 * @title AddLiquidity
 * @notice Script to add more liquidity to an existing Uniswap V3 pool
 * @dev Run with: forge script script/AddLiquidity.s.sol:AddLiquidity --rpc-url $BASE_SEPOLIA_RPC_URL --broadcast -vvvv
 */
contract AddLiquidity is Script {
    address constant POSITION_MANAGER = 0x27F971cb582BF9E50F397e4d29a5C7A34f11faA2;

    // Pool configuration
    uint24 constant POOL_FEE = 3000; // 0.3%
    int24 constant MIN_TICK = -887220;
    int24 constant MAX_TICK = 887220;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        address mockUSDC = vm.envAddress("MOCK_USDC_ADDRESS");
        address mockWBTC = vm.envAddress("MOCK_WBTC_ADDRESS");

        // Optional: specify existing position token ID to increase liquidity
        // uint256 positionTokenId = vm.envOr("POSITION_TOKEN_ID", uint256(0));

        console.log("Adding liquidity to pool...");
        console.log("Deployer:", deployer);

        // Sort tokens
        (address token0, address token1) = sortTokens(mockUSDC, mockWBTC);

        // Amounts to add
        uint256 usdcAmount = 50_000 * 10 ** 6; // 50,000 USDC
        uint256 wbtcAmount = 2 * 10 ** 8; // 2 WBTC

        uint256 amount0Desired = token0 == mockUSDC ? usdcAmount : wbtcAmount;
        uint256 amount1Desired = token0 == mockUSDC ? wbtcAmount : usdcAmount;

        vm.startBroadcast(deployerPrivateKey);

        // Approve tokens
        IERC20(mockUSDC).approve(POSITION_MANAGER, usdcAmount);
        IERC20(mockWBTC).approve(POSITION_MANAGER, wbtcAmount);

        INonfungiblePositionManager positionManager = INonfungiblePositionManager(POSITION_MANAGER);

        // Create new position
        INonfungiblePositionManager.MintParams memory params = INonfungiblePositionManager.MintParams({
            token0: token0,
            token1: token1,
            fee: POOL_FEE,
            tickLower: MIN_TICK,
            tickUpper: MAX_TICK,
            amount0Desired: amount0Desired,
            amount1Desired: amount1Desired,
            amount0Min: 0,
            amount1Min: 0,
            recipient: deployer,
            deadline: block.timestamp + 3600
        });

        (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1) = positionManager.mint(params);

        vm.stopBroadcast();

        console.log("\n========================================");
        console.log("LIQUIDITY ADDED");
        console.log("========================================");
        console.log("Position Token ID:", tokenId);
        console.log("Liquidity:", liquidity);
        console.log("Amount0 used:", amount0);
        console.log("Amount1 used:", amount1);
        console.log("========================================\n");
    }

    function sortTokens(address tokenA, address tokenB) internal pure returns (address token0, address token1) {
        (token0, token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
    }
}
