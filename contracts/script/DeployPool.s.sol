// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../src/interfaces/IUniswapV3Factory.sol";
import "../src/interfaces/IUniswapV3Pool.sol";
import "../src/interfaces/INonfungiblePositionManager.sol";

/**
 * @title DeployPool
 * @notice Script to create a Uniswap V3 pool and add initial liquidity on Base Sepolia
 * @dev Run with: forge script script/DeployPool.s.sol:DeployPool --rpc-url $BASE_SEPOLIA_RPC_URL --broadcast -vvvv
 */
contract DeployPool is Script {
    // Uniswap V3 addresses on Base Sepolia
    address constant UNISWAP_V3_FACTORY = 0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24;
    address constant POSITION_MANAGER = 0x27F971cb582BF9E50F397e4d29a5C7A34f11faA2;

    // Pool configuration
    uint24 constant POOL_FEE = 3000; // 0.3%
    int24 constant TICK_SPACING = 60;
    int24 constant MIN_TICK = -887220;
    int24 constant MAX_TICK = 887220;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        address mockUSDC = vm.envAddress("MOCK_USDC_ADDRESS");
        address mockWBTC = vm.envAddress("MOCK_WBTC_ADDRESS");

        console.log("Deployer:", deployer);
        console.log("MockUSDC:", mockUSDC);
        console.log("MockWBTC:", mockWBTC);

        // Sort tokens
        (address token0, address token1) = _sortTokens(mockUSDC, mockWBTC);
        console.log("Token0:", token0);
        console.log("Token1:", token1);

        // Calculate sqrtPriceX96 for initial price
        // Using a simple price: 1 BTC = 45000 USDC
        uint160 sqrtPriceX96;
        if (token0 == mockUSDC) {
            sqrtPriceX96 = 53122127829090968902401679360;
            console.log("USDC is token0");
        } else {
            sqrtPriceX96 = 5312212782909096890240167936000;
            console.log("WBTC is token0");
        }

        vm.startBroadcast(deployerPrivateKey);

        // Create and initialize pool
        address poolAddress = INonfungiblePositionManager(POSITION_MANAGER)
            .createAndInitializePoolIfNecessary(token0, token1, POOL_FEE, sqrtPriceX96);
        
        console.log("Pool created at:", poolAddress);

        // Approve tokens
        uint256 usdcAmount = 100_000 * 10 ** 6;
        uint256 wbtcAmount = 5 * 10 ** 8;
        
        IERC20(mockUSDC).approve(POSITION_MANAGER, usdcAmount);
        IERC20(mockWBTC).approve(POSITION_MANAGER, wbtcAmount);

        // Add liquidity
        _addLiquidity(token0, token1, mockUSDC, usdcAmount, wbtcAmount, deployer);

        vm.stopBroadcast();

        // Output summary
        console.log("========================================");
        console.log("Pool Address:", poolAddress);
        console.log("Token0:", token0);
        console.log("Token1:", token1);
        console.log("Fee: 3000 (0.3%)");
        console.log("========================================");
    }

    function _sortTokens(address tokenA, address tokenB) internal pure returns (address, address) {
        return tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
    }

    function _addLiquidity(
        address token0,
        address token1,
        address mockUSDC,
        uint256 usdcAmount,
        uint256 wbtcAmount,
        address recipient
    ) internal {
        uint256 amount0 = token0 == mockUSDC ? usdcAmount : wbtcAmount;
        uint256 amount1 = token0 == mockUSDC ? wbtcAmount : usdcAmount;

        INonfungiblePositionManager.MintParams memory params = INonfungiblePositionManager.MintParams({
            token0: token0,
            token1: token1,
            fee: POOL_FEE,
            tickLower: MIN_TICK,
            tickUpper: MAX_TICK,
            amount0Desired: amount0,
            amount1Desired: amount1,
            amount0Min: 0,
            amount1Min: 0,
            recipient: recipient,
            deadline: block.timestamp + 3600
        });

        (uint256 tokenId, uint128 liquidity, uint256 used0, uint256 used1) = 
            INonfungiblePositionManager(POSITION_MANAGER).mint(params);

        console.log("Position NFT ID:", tokenId);
        console.log("Liquidity:", uint256(liquidity));
        console.log("Amount0 used:", used0);
        console.log("Amount1 used:", used1);
    }
}
