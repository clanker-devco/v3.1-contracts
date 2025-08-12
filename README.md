# v3.1-contracts

Smart contracts of Clanker v3.1

Clanker is an autonomous agent for deploying tokens. Currently, users may request clanker to deploy an ERC-20 token on Base by tagging [@clanker](https://warpcast.com/clanker/casts-and-replies) on Farcaster, on our website [clanker.world](https://www.clanker.world/deploy), by using one of our interface partners, or through the smart contracts directly. This repo contains the onchain code utilized by the clanker agent for token deployment, vaulting, and LP fee distribution.

Documentation for the v3.1.0 contracts can be found [here](specs/v3_1_0.md) and our general docs can be found [here](https://clanker.gitbook.io/clanker-documentation).


## Fee structure and rewards
As Clanker deploys tokens, it initiates 1% fee Uniswap V3 pools on Base. As each token is traded, 1% of each swap in this pool is collected and is assigned as a reward:

- 20% of swap fees - Clanker Team
- 80% of fees split between creator and interface (immutable after token deployment)

## Deployed Contracts

Check out our [dune dashboards](https://dune.com/clanker_protection_team) for token stats and our website [clanker.world](https://clanker.world) to see the clanker tokens in action and to launch a token from a form interface.

### v3.1.0 (Base Mainnet), tag: [v3.1](https://github.com/clanker-devco/v3.1-contracts/releases/tag/v3.1)
- Clanker Factory (v3.1.0): [0x2A787b2362021cC3eEa3C24C4748a6cD5B687382](https://basescan.org/address/0x2A787b2362021cC3eEa3C24C4748a6cD5B687382)
- LpLockerv2 (v3.1.0): [0x33e2Eda238edcF470309b8c6D228986A1204c8f9](https://basescan.org/address/0x33e2Eda238edcF470309b8c6D228986A1204c8f9)
- ClankerVault (v3.1.0): [0x42A95190B4088C88Dd904d930c79deC1158bF09D](https://basescan.org/address/0x42A95190B4088C88Dd904d930c79deC1158bF09D)

### v3.1.0 (Abstract Mainnet), tag: [v3.1-no-superchain](https://github.com/clanker-devco/v3.1-contracts/releases/tag/v3.1-non-superchains)
- Clanker Factory (v3.1.0): [0x043ac6264F5A45c7518DC480b348Da41bdabbac2](https://abscan.org/address/0x043ac6264F5A45c7518DC480b348Da41bdabbac2)
- LpLockerv2 (v3.1.0): [0xF5eBBd10d2faF7970dBdb9E960639ABCd612c48D](https://abscan.org/address/0xF5eBBd10d2faF7970dBdb9E960639ABCd612c48D)
- ClankerVault (v3.1.0): [0x858eaD172d10b3E2Fc20F9C80726a2735c7B7a4B](https://abscan.org/address/0x858eaD172d10b3E2Fc20F9C80726a2735c7B7a4B)

### v3.1.0 (Base Sepolia)
- Clanker Factory (v3.1.0): [0x2A787b2362021cC3eEa3C24C4748a6cD5B687382](https://sepolia.basescan.org/address/0x2A787b2362021cC3eEa3C24C4748a6cD5B687382)
- LpLockerv2 (v3.1.0): [0xa1da0600Eb4A9F3D4a892feAa2c2caf80A4A2f14](https://sepolia.basescan.org/address/0xa1da0600Eb4A9F3D4a892feAa2c2caf80A4A2f14)
- ClankerVault (v3.1.0): [0xA9C0a423f0092176fC48d7B50a1fCae8cf5BB441](https://sepolia.basescan.org/address/0xA9C0a423f0092176fC48d7B50a1fCae8cf5BB441)

### v3.1.0 (Monad Testnet)
- Clanker Factory (v3.1.0): [0xA0C65813DD1Cde7092922a57548Ec1eD25994318](https://testnet.monadexplorer.com/address/0xA0C65813DD1Cde7092922a57548Ec1eD25994318)
- LpLockerv2 (v3.1.0): [0xcd89C55d36097a64f777066A6cc8F2c31B7541F7](https://testnet.monadexplorer.com/address/0xcd89C55d36097a64f777066A6cc8F2c31B7541F7)
- ClankerVault (v3.1.0): [0x9505A57Bf782058890f078bE301575cD75045a9b](https://testnet.monadexplorer.com/address/0x9505A57Bf782058890f078bE301575cD75045a9b)

If you'd like these contracts on another chain, [please reach out to us](https://clanker.gitbook.io/clanker-documentation/references/contact)! For superchain purposes, we need to ensure that the Clanker contracts have the same address.


## Usage

Token deployers should use the `Clanker::deployToken()` function to deploy tokens.

Note that the follow parameters are needed for deployment:
```solidity
/**
 * Configuration settings for token creation
 */

struct RewardsConfig {
    uint256 creatorReward;
    address creatorAdmin;
    address creatorRewardRecipient;
    address interfaceAdmin;
    address interfaceRewardRecipient;
}

struct TokenConfig {
    string name;
    string symbol;
    bytes32 salt;
    string image;
    string metadata;
    string context;
    uint256 originatingChainId;
}

struct VaultConfig {
    uint8 vaultPercentage;
    uint256 vaultDuration;
}

struct PoolConfig {
    address pairedToken;
    int24 tickIfToken0IsNewToken;
}

struct InitialBuyConfig {
    uint24 pairedTokenPoolFee;
    uint256 pairedTokenSwapAmountOutMinimum;
}

struct DeploymentConfig {
    TokenConfig tokenConfig;
    VaultConfig vaultConfig;
    PoolConfig poolConfig;
    InitialBuyConfig initialBuyConfig;
    RewardsConfig rewardsConfig;
}

function deployToken(DeploymentConfig tokenConfig) external payable {...}
```

Explanation of the parameters are in the [specs](specs/v3_1_0.md) folder. Please [reach out to us](https://clanker.gitbook.io/clanker-documentation/references/contact) if you have any questions! 
