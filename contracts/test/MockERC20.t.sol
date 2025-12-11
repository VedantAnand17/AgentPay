// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MockERC20.sol";

contract MockERC20Test is Test {
    MockERC20 public token;
    address public owner;
    address public user;

    function setUp() public {
        owner = address(this);
        user = address(0x1);
        token = new MockERC20("Test Token", "TEST", 18);
    }

    function test_InitialState() public view {
        assertEq(token.name(), "Test Token");
        assertEq(token.symbol(), "TEST");
        assertEq(token.decimals(), 18);
        assertEq(token.totalSupply(), 0);
    }

    function test_Mint() public {
        uint256 amount = 1000 * 10 ** 18;
        token.mint(user, amount);
        assertEq(token.balanceOf(user), amount);
        assertEq(token.totalSupply(), amount);
    }

    function test_Faucet() public {
        uint256 amount = 100 * 10 ** 18;
        vm.prank(user);
        token.faucet(amount);
        assertEq(token.balanceOf(user), amount);
    }

    function test_FaucetLimit() public {
        uint256 maxAmount = 10000 * 10 ** 18;
        
        // Should succeed at max
        vm.prank(user);
        token.faucet(maxAmount);
        
        // Should fail above max
        vm.prank(user);
        vm.expectRevert("Exceeds faucet limit");
        token.faucet(maxAmount + 1);
    }

    function test_Burn() public {
        uint256 amount = 1000 * 10 ** 18;
        token.mint(owner, amount);
        
        token.burn(amount / 2);
        assertEq(token.balanceOf(owner), amount / 2);
        assertEq(token.totalSupply(), amount / 2);
    }

    function test_CustomDecimals() public {
        MockERC20 usdc = new MockERC20("Mock USDC", "USDC", 6);
        assertEq(usdc.decimals(), 6);
        
        MockERC20 wbtc = new MockERC20("Mock WBTC", "WBTC", 8);
        assertEq(wbtc.decimals(), 8);
    }
}
