// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IClanker {
    /// @notice When an unauthorized user calls a function
    error Unauthorized();
    /// @notice When the factory is deprecated
    error Deprecated();
    /// @notice When a tokenId is not found
    error NotFound();
    /// @notice When the tick spacing is invalid
    error InvalidTick();
    /// @notice When the vault percentage is invalid
    error InvalidVaultConfiguration();
    /// @notice When the function is only valid on the originating chain
    error OnlyOriginatingChain();
    /// @notice When the function is only valid on a non-originating chain
    error OnlyNonOriginatingChains();
    /// @notice When the creator reward is invalid (greater than 80%)
    error InvalidCreatorReward();
    /// @notice When the creator information is invalid
    error InvalidCreatorInfo();
    /// @notice When the interface information is invalid
    error InvalidInterfaceInfo();
    /// @notice When the team reward recipient is invalid
    error ZeroTeamRewardRecipient();

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

    struct RewardsConfig {
        uint256 creatorReward;
        address creatorAdmin;
        address creatorRewardRecipient;
        address interfaceAdmin;
        address interfaceRewardRecipient;
    }

    struct DeploymentConfig {
        TokenConfig tokenConfig;
        VaultConfig vaultConfig;
        PoolConfig poolConfig;
        InitialBuyConfig initialBuyConfig;
        RewardsConfig rewardsConfig;
    }

    struct DeploymentInfo {
        address token;
        uint256 positionId;
        address locker;
    }

    event TokenCreated(
        address indexed tokenAddress,
        address indexed creatorAdmin,
        address indexed interfaceAdmin,
        address creatorRewardRecipient,
        address interfaceRewardRecipient,
        uint256 positionId,
        string name,
        string symbol,
        int24 startingTickIfToken0IsNewToken,
        string metadata,
        uint256 amountTokensBought,
        uint256 vaultDuration,
        uint8 vaultPercentage,
        address msgSender
    );

    event VaultUpdated(address oldVault, address newVault);
    event LiquidityLockerUpdated(address oldLocker, address newLocker);
    event ClankerDeployerUpdated(address oldClankerDeployer, address newClankerDeployer);
    event SetDeprecated(bool deprecated);
    event SetAdmin(address admin, bool isAdmin);

    function MAX_CREATOR_REWARD() external pure returns (uint256);
    function TOKEN_SUPPLY() external pure returns (uint256);

    function deprecated() external view returns (bool);
    function admins(address) external view returns (bool);

    function getTokensDeployedByUser(address user)
        external
        view
        returns (DeploymentInfo[] memory);

    function updateLiquidityLocker(address newLocker) external;
    function updateVault(address newVault) external;
    function setDeprecated(bool deprecated_) external;
    function setAdmin(address admin, bool isAdmin) external;
    function claimRewards(address token) external;

    function deployTokenWithCustomTeamRewardRecipient(
        DeploymentConfig memory deploymentConfig,
        address teamRewardRecipient
    ) external payable returns (address tokenAddress, uint256 positionId);

    function deployToken(DeploymentConfig memory deploymentConfig)
        external
        payable
        returns (address tokenAddress, uint256 positionId);
}
