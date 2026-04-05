# DegenScreener Contracts

## Setup

```bash
cd contracts
forge install OpenZeppelin/openzeppelin-contracts --no-commit
forge install foundry-rs/forge-std --no-commit
forge build
forge test
```

## Deploy (Base Sepolia)

```bash
export PRIVATE_KEY=0x...
export BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast
```

After deployment, set `DSCREEN_CONTRACT_ADDRESS` in `.env`.
