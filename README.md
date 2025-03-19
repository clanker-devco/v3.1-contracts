# v3.1-contracts

Smart contracts of Clanker v3.1

Clanker is an autonomous agent for deploying tokens. Currently, users may request clanker to deploy an ERC-20 token on Base by tagging @clanker on Farcaster, on our website [clanker.world](https://www.clanker.world/deploy), by using one of our interface partners, or through the smart contracts directly. This repo contains the onchain code utilized by the clanker agent for token deployment, vaulting, and LP fee distribution.

Documentation for the v3.1.0 contracts can be found [here](specs/v3_1_0.md).


## Fee structure and rewards
As Clanker deploys tokens, it initiates 1% fee Uniswap V3 pools on Base. As each token is traded, 1% of each swap in this pool is collected and is assigned as a reward:

- 20% of swap fees - Clanker Team
- 80% of fees split between creator and interface (immutable after token deployment)

## Deployed Contracts

Check out our [dune dashboards](https://dune.com/clanker_protection_team) for token stats and our website [clanker.world](https://clanker.world) to see the clanker tokens in action and to launch a token from a form interface.

### v3.1.0 (Base Mainnet)
Base Mainnet:
- Clanker Factory (v3.1.0): [0x2A787b2362021cC3eEa3C24C4748a6cD5B687382](https://basescan.org/address/0x2A787b2362021cC3eEa3C24C4748a6cD5B687382)
- LpLockerv2 (v3.1.0): [0x33e2Eda238edcF470309b8c6D228986A1204c8f9](https://basescan.org/address/0x33e2Eda238edcF470309b8c6D228986A1204c8f9)
- ClankerVault (v3.1.0): [0x42A95190B4088C88Dd904d930c79deC1158bF09D](https://basescan.org/address/0x42A95190B4088C88Dd904d930c79deC1158bF09D)

### v3.1.0 (Base Sepolia)
- Clanker Factory (v3.1.0): [0x2A787b2362021cC3eEa3C24C4748a6cD5B687382](https://sepolia.basescan.org/address/0x2A787b2362021cC3eEa3C24C4748a6cD5B687382)
- LpLockerv2 (v3.1.0): [0xa1da0600Eb4A9F3D4a892feAa2c2caf80A4A2f14](https://sepolia.basescan.org/address/0xa1da0600Eb4A9F3D4a892feAa2c2caf80A4A2f14)
- ClankerVault (v3.1.0): [0xA9C0a423f0092176fC48d7B50a1fCae8cf5BB441](https://sepolia.basescan.org/address/0xA9C0a423f0092176fC48d7B50a1fCae8cf5BB441)

If you'd like these contracts on another chain, please let us know! For superchain purposes, we need to ensure that the Clanker contracts have the same address.
