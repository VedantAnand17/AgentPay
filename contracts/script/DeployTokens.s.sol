// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../src/MockERC20.sol";

/**
 * @title DeployTokens
 * @notice Script to deploy mock USDC and WBTC tokens on Base Sepolia
 * @dev Run with: forge script script/DeployTokens.s.sol:DeployTokens --rpc-url $BASE_SEPOLIA_RPC_URL --broadcast -vvvv
 */
contract DeployTokens is Script {
    function run() external {
        // Get private key from environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("Deployer address:", deployer);
        console.log("Deployer balance:", deployer.balance);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy Mock USDC (6 decimals like real USDC)
        MockERC20 mockUSDC = new MockERC20("Mock USDC", "USDC", 6);
        console.log("MockUSDC deployed at:", address(mockUSDC));

        // Deploy Mock WBTC (8 decimals like real WBTC)
        MockERC20 mockWBTC = new MockERC20("Mock Wrapped Bitcoin", "WBTC", 8);
        console.log("MockWBTC deployed at:", address(mockWBTC));

        // Mint initial supply to deployer
        // Mint 1,000,000 USDC
        uint256 usdcAmount = 1_000_000 * 10 ** 6;
        mockUSDC.mint(deployer, usdcAmount);
        console.log("Minted USDC to deployer:", usdcAmount);

        // Mint 100 WBTC
        uint256 wbtcAmount = 100 * 10 ** 8;
        mockWBTC.mint(deployer, wbtcAmount);
        console.log("Minted WBTC to deployer:", wbtcAmount);

        vm.stopBroadcast();

        // Output deployment summary
        console.log("\n========================================");
        console.log("DEPLOYMENT SUMMARY");
        console.log("========================================");
        console.log("Network: Base Sepolia");
        console.log("Deployer:", deployer);
        console.log("\nToken Addresses:");
        console.log("  MockUSDC:", address(mockUSDC));
        console.log("  MockWBTC:", address(mockWBTC));
        console.log("\nUpdate your .env file with:");
        console.log("  MOCK_USDC_ADDRESS=", address(mockUSDC));
        console.log("  MOCK_WBTC_ADDRESS=", address(mockWBTC));
        console.log("========================================\n");
    }
}
