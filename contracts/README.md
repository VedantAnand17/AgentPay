# AgentPay Smart Contracts

This folder contains Foundry-based smart contracts for deploying Uniswap V3 pools on Base Sepolia testnet.

## Quick Start (Automated)

```bash
cd contracts

# 1. Install dependencies
forge install OpenZeppelin/openzeppelin-contracts@v4.9.3
forge install foundry-rs/forge-std

# 2. Create and configure .env
cp .env.example .env
# Edit .env with your private key

# 3. Run automated deployment
./script/Deploy.sh
```

## Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- Base Sepolia ETH for gas (get from [Base Sepolia Faucet](https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet))

## Manual Setup

1. Install Foundry (if not already installed):
```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

2. Install dependencies:
```bash
cd contracts
forge install OpenZeppelin/openzeppelin-contracts@v4.9.3
forge install foundry-rs/forge-std
```

3. Create `.env` file in the contracts folder:
```bash
cp .env.example .env
# Edit .env with your private key and RPC URL
```

## Contracts Overview

### Mock Tokens
- `MockERC20.sol` - Generic mock ERC20 token with mint function
- Used to deploy MockUSDC and MockWBTC for testing

### Scripts
- `DeployTokens.s.sol` - Deploy mock USDC and WBTC tokens
- `DeployPool.s.sol` - Create Uniswap V3 pool and add initial liquidity

## Deployment Steps

### 1. Deploy Mock Tokens

```bash
# Load environment variables
source .env

# Deploy mock tokens on Base Sepolia
forge script script/DeployTokens.s.sol:DeployTokens \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --broadcast \
  --verify \
  -vvvv
```

### 2. Deploy Uniswap V3 Pool

After deploying tokens, update the token addresses in the deployment script, then:

```bash
forge script script/DeployPool.s.sol:DeployPool \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --broadcast \
  --verify \
  -vvvv
```

## Base Sepolia Uniswap V3 Addresses

These are the official Uniswap V3 contract addresses on Base Sepolia:

| Contract | Address |
|----------|---------|
| UniswapV3Factory | `0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24` |
| SwapRouter02 | `0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4` |
| NonfungiblePositionManager | `0x27F971cb582BF9E50F397e4d29a5C7A34f11faA2` |
| QuoterV2 | `0xC5290058841028F1614F3A6F0F5816cAd0df5E27` |

## Configuration

After deployment, update your `.env` file in the project root with the deployed addresses:

```env
# Uniswap V3 Configuration (Base Sepolia)
UNISWAP_V3_FACTORY=0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24
UNISWAP_V3_SWAP_ROUTER=0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4
UNISWAP_V3_POSITION_MANAGER=0x27F971cb582BF9E50F397e4d29a5C7A34f11faA2
UNISWAP_V3_QUOTER=0xC5290058841028F1614F3A6F0F5816cAd0df5E27

# Pool Tokens (update after deployment)
POOL_TOKEN0_ADDRESS=<deployed_usdc_address>
POOL_TOKEN1_ADDRESS=<deployed_wbtc_address>
POOL_FEE=3000
```

## Testing

```bash
forge test -vvv
```

## Gas Reports

```bash
forge test --gas-report
```

## License

MIT
