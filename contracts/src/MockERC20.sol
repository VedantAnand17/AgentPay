// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockERC20
 * @dev A simple ERC20 token with mint functionality for testing purposes.
 * Used to create mock USDC and WBTC tokens on testnets.
 */
contract MockERC20 is ERC20, Ownable {
    uint8 private _decimals;

    /**
     * @dev Constructor that sets the token name, symbol, and decimals.
     * @param name_ The name of the token (e.g., "Mock USDC")
     * @param symbol_ The symbol of the token (e.g., "USDC")
     * @param decimals_ The number of decimals for the token (e.g., 6 for USDC, 8 for BTC)
     */
    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_
    ) ERC20(name_, symbol_) {
        _decimals = decimals_;
        _transferOwnership(msg.sender);
    }

    /**
     * @dev Returns the number of decimals used for token amounts.
     */
    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    /**
     * @dev Mints tokens to the specified address.
     * @param to The address to mint tokens to
     * @param amount The amount of tokens to mint (in base units)
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /**
     * @dev Public mint function for faucet purposes on testnet.
     * Anyone can mint up to 10,000 USDC equivalent per call.
     * @param amount The amount of tokens to mint
     */
    function faucet(uint256 amount) external {
        // Limit faucet to reasonable amounts
        uint256 maxMint = 10000 * (10 ** _decimals);
        require(amount <= maxMint, "Exceeds faucet limit");
        _mint(msg.sender, amount);
    }

    /**
     * @dev Burn tokens from the caller's address.
     * @param amount The amount of tokens to burn
     */
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}
