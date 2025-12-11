#!/bin/bash

# ===========================================
# AgentPay Uniswap V3 Pool Deployment Script
# ===========================================
# This script automates the deployment of mock tokens and a Uniswap V3 pool
# on Base Sepolia testnet.

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}AgentPay Uniswap V3 Pool Deployment${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${RED}Error: .env file not found!${NC}"
    echo "Please create a .env file with your configuration:"
    echo "  cp .env.example .env"
    echo "  # Edit .env with your private key"
    exit 1
fi

# Load environment variables
source .env

# Check required variables
if [ -z "$PRIVATE_KEY" ]; then
    echo -e "${RED}Error: PRIVATE_KEY not set in .env${NC}"
    exit 1
fi

if [ -z "$BASE_SEPOLIA_RPC_URL" ]; then
    BASE_SEPOLIA_RPC_URL="https://sepolia.base.org"
fi

echo -e "${YELLOW}Using RPC: ${BASE_SEPOLIA_RPC_URL}${NC}"
echo ""

# Step 1: Install dependencies if needed
if [ ! -d "lib/openzeppelin-contracts" ]; then
    echo -e "${YELLOW}Installing OpenZeppelin contracts...${NC}"
    forge install OpenZeppelin/openzeppelin-contracts@v4.9.3
fi

if [ ! -d "lib/forge-std" ]; then
    echo -e "${YELLOW}Installing forge-std...${NC}"
    forge install foundry-rs/forge-std
fi

# Step 2: Build contracts
echo -e "${YELLOW}Building contracts...${NC}"
forge build

# Step 3: Deploy mock tokens
echo ""
echo -e "${GREEN}Step 1/2: Deploying Mock Tokens${NC}"
echo -e "${YELLOW}This will deploy MockUSDC and MockWBTC...${NC}"
echo ""

DEPLOY_OUTPUT=$(forge script script/DeployTokens.s.sol:DeployTokens \
    --rpc-url $BASE_SEPOLIA_RPC_URL \
    --broadcast \
    -vvv 2>&1)

echo "$DEPLOY_OUTPUT"

# Extract token addresses from output
USDC_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep -oP 'MockUSDC deployed at: \K0x[a-fA-F0-9]+' | head -1)
WBTC_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep -oP 'MockWBTC deployed at: \K0x[a-fA-F0-9]+' | head -1)

if [ -z "$USDC_ADDRESS" ] || [ -z "$WBTC_ADDRESS" ]; then
    echo -e "${RED}Failed to extract token addresses from deployment output${NC}"
    echo "Please manually update .env with the deployed addresses"
    exit 1
fi

echo ""
echo -e "${GREEN}Token Deployment Complete!${NC}"
echo -e "MockUSDC: ${USDC_ADDRESS}"
echo -e "MockWBTC: ${WBTC_ADDRESS}"

# Update .env with token addresses
echo ""
echo -e "${YELLOW}Updating .env with token addresses...${NC}"

# Add or update MOCK_USDC_ADDRESS
if grep -q "^MOCK_USDC_ADDRESS=" .env; then
    sed -i "s|^MOCK_USDC_ADDRESS=.*|MOCK_USDC_ADDRESS=${USDC_ADDRESS}|" .env
else
    echo "MOCK_USDC_ADDRESS=${USDC_ADDRESS}" >> .env
fi

# Add or update MOCK_WBTC_ADDRESS
if grep -q "^MOCK_WBTC_ADDRESS=" .env; then
    sed -i "s|^MOCK_WBTC_ADDRESS=.*|MOCK_WBTC_ADDRESS=${WBTC_ADDRESS}|" .env
else
    echo "MOCK_WBTC_ADDRESS=${WBTC_ADDRESS}" >> .env
fi

# Reload environment
source .env

echo ""
echo -e "${GREEN}Step 2/2: Creating Uniswap V3 Pool${NC}"
echo -e "${YELLOW}This will create a USDC/WBTC pool with 0.3% fee...${NC}"
echo ""

# Wait a bit for token deployments to propagate
sleep 5

POOL_OUTPUT=$(forge script script/DeployPool.s.sol:DeployPool \
    --rpc-url $BASE_SEPOLIA_RPC_URL \
    --broadcast \
    -vvv 2>&1)

echo "$POOL_OUTPUT"

# Extract pool address
POOL_ADDRESS=$(echo "$POOL_OUTPUT" | grep -oP 'Pool created at: \K0x[a-fA-F0-9]+' | head -1)

if [ -z "$POOL_ADDRESS" ]; then
    # Try alternative pattern
    POOL_ADDRESS=$(echo "$POOL_OUTPUT" | grep -oP 'Pool Address: \K0x[a-fA-F0-9]+' | head -1)
fi

if [ -n "$POOL_ADDRESS" ]; then
    echo ""
    echo -e "${GREEN}Pool Deployment Complete!${NC}"
    echo -e "Pool Address: ${POOL_ADDRESS}"
    
    # Update .env with pool address
    if grep -q "^UNISWAP_V3_POOL_ADDRESS=" .env; then
        sed -i "s|^UNISWAP_V3_POOL_ADDRESS=.*|UNISWAP_V3_POOL_ADDRESS=${POOL_ADDRESS}|" .env
    else
        echo "UNISWAP_V3_POOL_ADDRESS=${POOL_ADDRESS}" >> .env
    fi
else
    echo -e "${YELLOW}Could not extract pool address automatically${NC}"
    echo "Please manually update UNISWAP_V3_POOL_ADDRESS in .env"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}DEPLOYMENT COMPLETE!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Deployed Addresses:"
echo "  MockUSDC:    ${USDC_ADDRESS}"
echo "  MockWBTC:    ${WBTC_ADDRESS}"
echo "  Pool:        ${POOL_ADDRESS:-'Check deployment logs'}"
echo ""
echo "Next Steps:"
echo "1. Copy the addresses above to your project's root .env file"
echo "2. Make sure to also update:"
echo "   - MOCK_USDC_ADDRESS=${USDC_ADDRESS}"
echo "   - MOCK_WBTC_ADDRESS=${WBTC_ADDRESS}"
echo "   - UNISWAP_V3_POOL_ADDRESS=${POOL_ADDRESS:-'<pool_address>'}"
echo ""
echo -e "${GREEN}========================================${NC}"
