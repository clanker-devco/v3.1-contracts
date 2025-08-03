// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ClankerDeployer} from "./ClankerDeployer.sol";

import {IClanker} from "./interfaces/IClanker.sol";
import {IClankerVault} from "./interfaces/IClankerVault.sol";
import {ILpLockerv2} from "./interfaces/ILpLockerv2.sol";
import {
    INonfungiblePositionManager,
    ISwapRouter,
    IUniswapV3Factory,
    IUniswapV3Pool
} from "./interfaces/uniswapv3.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {TickMath} from "@uniswap/v3-core/contracts/libraries/TickMath.sol";

////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                        //
//                                                                                        //
//                                                 /$$      /$$                           //
//                                                | $$     | $/                           //
//                              /$$$$$$   /$$$$$$ | $$$$$$$|_/                            //
//                             /$$__  $$ /$$__  $$| $$__  $$                              //
//                            | $$  \ $$| $$  \ $$| $$  \ $$                              //
//                            | $$  | $$| $$  | $$| $$  | $$                              //
//                            |  $$$$$$/|  $$$$$$/| $$  | $$                              //
//                             \______/  \______/ |__/  |__/                              //
//                                                                                        //
//                                                                                        //
//                                                                                        //
//               /$$                     /$$                   /$$             /$$        //
//              | $$                    | $$                  | $$            | $$        //
//      /$$$$$$$| $$  /$$$$$$  /$$$$$$$ | $$   /$$        /$$$$$$$  /$$$$$$  /$$$$$$      //
//     /$$_____/| $$ |____  $$| $$__  $$| $$  /$$/       /$$__  $$ |____  $$|_  $$_/      //
//    | $$      | $$  /$$$$$$$| $$  \ $$| $$$$$$/       | $$  | $$  /$$$$$$$  | $$        //
//    | $$      | $$ /$$__  $$| $$  | $$| $$_  $$       | $$  | $$ /$$__  $$  | $$ /$$    //
//    |  $$$$$$$| $$|  $$$$$$$| $$  | $$| $$ \  $$      |  $$$$$$$|  $$$$$$$  |  $$$$/    //
//     \_______/|__/ \_______/|__/  |__/|__/  \__/       \_______/ \_______/   \___/      //
//                                                                                        //
//                                                                                        //
//                                                                                        //
//                                                                                        //
//                                                                                        //
////////////////////////////////////////////////////////////////////////////////////////////

/// @notice Clanker Token Launcher
contract Clanker is Ownable, ReentrancyGuard, IClanker {
    using TickMath for int24;

    string constant version = "0.3.1";

    IUniswapV3Factory public uniswapV3Factory;
    INonfungiblePositionManager public positionManager;
    ISwapRouter public swapRouter;
    address public weth;

    uint256 public constant TOKEN_SUPPLY = 100_000_000_000_000_000_000_000_000_000; // 100b with 18 decimals
    uint24 public constant POOL_FEE = 10_000; // 1%
    int24 public constant TICK_SPACING = 200;
    int24 public constant MAX_TICK = 887_200;

    ILpLockerv2 public liquidityLocker;
    IClankerVault public vault;
    uint256 public constant MAX_CREATOR_REWARD = 80;
    uint256 public constant MAX_VAULT_PERCENTAGE = 30;

    bool public deprecated;

    mapping(address => bool) public admins;

    mapping(address => DeploymentInfo[]) public tokensDeployedByUsers;
    mapping(address => DeploymentInfo) public deploymentInfoForToken;

    constructor(address owner_) Ownable(owner_) {
        // only non-originating tokens deployments are enabled
        // before initialization
        deprecated = true;
    }

    function initialize(
        address uniswapV3Factory_,
        address positionManager_,
        address swapRouter_,
        address weth_,
        address liquidityLocker_,
        address vault_
    ) external onlyOwner {
        // uniswap configurations
        uniswapV3Factory = IUniswapV3Factory(uniswapV3Factory_);
        positionManager = INonfungiblePositionManager(positionManager_);
        swapRouter = ISwapRouter(swapRouter_);

        // weth configurations
        weth = weth_;
        IERC20(weth).approve(address(positionManager), type(uint256).max);

        // liquidity locker configurations
        liquidityLocker = ILpLockerv2(liquidityLocker_);

        // vault configurations
        vault = IClankerVault(vault_);

        // enable deployments
        deprecated = false;
    }

    function getTokensDeployedByUser(address user)
        external
        view
        returns (DeploymentInfo[] memory)
    {
        return tokensDeployedByUsers[user];
    }

    function updateLiquidityLocker(address newLocker) external onlyOwner {
        address oldLocker = address(liquidityLocker);
        liquidityLocker = ILpLockerv2(newLocker);
        emit LiquidityLockerUpdated(oldLocker, newLocker);
    }

    function updateVault(address newVault) external onlyOwner {
        address oldVault = address(vault);
        vault = IClankerVault(newVault);
        emit VaultUpdated(oldVault, newVault);
    }

    function setDeprecated(bool deprecated_) external onlyOwner {
        deprecated = deprecated_;
        emit SetDeprecated(deprecated_);
    }

    function setAdmin(address admin, bool isAdmin) external onlyOwner {
        admins[admin] = isAdmin;
        emit SetAdmin(admin, isAdmin);
    }

    function claimRewards(address token) external {
        DeploymentInfo memory deploymentInfo = deploymentInfoForToken[token];

        if (deploymentInfo.token == address(0)) revert NotFound();

        ILpLockerv2(deploymentInfo.locker).collectRewards(deploymentInfo.positionId);
    }

    // Deploy a token with a custom protocol reward recipient,
    // only protocol admins can call this function
    function deployTokenWithCustomTeamRewardRecipient(
        DeploymentConfig memory deploymentConfig,
        address teamRewardRecipient
    ) external payable returns (address tokenAddress, uint256 positionId) {
        if (!admins[msg.sender]) revert Unauthorized();
        if (teamRewardRecipient == address(0)) revert ZeroTeamRewardRecipient();

        (tokenAddress, positionId) = deployToken(deploymentConfig);

        // set the override protocol reward recipient for the token
        liquidityLocker.setOverrideTeamRewardRecipientForToken(positionId, teamRewardRecipient);
    }

    // Deploy a token and pool with the option to vault the token and buy an initial amount
    function deployToken(DeploymentConfig memory deploymentConfig)
        public
        payable
        nonReentrant
        returns (address tokenAddress, uint256 positionId)
    {
        if (deprecated) revert Deprecated();
        if (block.chainid != deploymentConfig.tokenConfig.originatingChainId) {
            revert OnlyOriginatingChain();
        }

        // deploy the token
        tokenAddress = ClankerDeployer.deployToken(
            deploymentConfig.tokenConfig, deploymentConfig.rewardsConfig.creatorAdmin, TOKEN_SUPPLY
        );
        uint256 poolSupply = TOKEN_SUPPLY;
        uint256 vaultSupply = 0;

        // attempt to vault the token if the vault config was set
        if (
            deploymentConfig.vaultConfig.vaultDuration > 0
                || deploymentConfig.vaultConfig.vaultPercentage > 0
        ) {
            (poolSupply, vaultSupply) = _vaultToken(
                tokenAddress,
                deploymentConfig.vaultConfig.vaultPercentage,
                deploymentConfig.vaultConfig.vaultDuration,
                deploymentConfig.rewardsConfig.creatorAdmin
            );
        }

        // configure the pool
        IERC20(tokenAddress).approve(address(positionManager), poolSupply);
        positionId = _configurePool(
            tokenAddress,
            deploymentConfig.poolConfig.pairedToken,
            deploymentConfig.poolConfig.tickIfToken0IsNewToken,
            poolSupply
        );

        // lock the lp tokens
        _lockLPTokens(positionId, deploymentConfig.rewardsConfig);

        // perform initial buy if eth was sent, use the creator admin as the recipient
        uint256 amountTokensBought = msg.value > 0
            ? _initialBuy(
                tokenAddress,
                deploymentConfig.poolConfig.pairedToken,
                deploymentConfig.initialBuyConfig.pairedTokenPoolFee,
                deploymentConfig.initialBuyConfig.pairedTokenSwapAmountOutMinimum,
                deploymentConfig.rewardsConfig.creatorAdmin
            )
            : 0;

        // add the deployment info to the deployment info for token
        DeploymentInfo memory deploymentInfo = DeploymentInfo({
            token: tokenAddress,
            positionId: positionId,
            locker: address(liquidityLocker)
        });
        deploymentInfoForToken[tokenAddress] = deploymentInfo;
        tokensDeployedByUsers[deploymentConfig.rewardsConfig.creatorAdmin].push(deploymentInfo);

        emit TokenCreated({
            tokenAddress: tokenAddress,
            positionId: positionId,
            creatorAdmin: deploymentConfig.rewardsConfig.creatorAdmin,
            creatorRewardRecipient: deploymentConfig.rewardsConfig.creatorRewardRecipient,
            interfaceAdmin: deploymentConfig.rewardsConfig.interfaceAdmin,
            interfaceRewardRecipient: deploymentConfig.rewardsConfig.interfaceRewardRecipient,
            name: deploymentConfig.tokenConfig.name,
            symbol: deploymentConfig.tokenConfig.symbol,
            startingTickIfToken0IsNewToken: deploymentConfig.poolConfig.tickIfToken0IsNewToken,
            metadata: deploymentConfig.tokenConfig.metadata,
            amountTokensBought: amountTokensBought,
            vaultDuration: deploymentConfig.vaultConfig.vaultDuration,
            vaultPercentage: deploymentConfig.vaultConfig.vaultPercentage,
            msgSender: msg.sender
        });
    }

    // Vault a token and allocate the vault supply to the vault allocation admin
    function _vaultToken(
        address token,
        uint8 vaultPercentage,
        uint256 vaultDuration,
        address vaultAllocationAdmin
    ) internal returns (uint256 poolSupply, uint256 vaultSupply) {
        if (vaultPercentage > MAX_VAULT_PERCENTAGE || vaultPercentage == 0) {
            revert InvalidVaultConfiguration();
        }
        vaultSupply = (TOKEN_SUPPLY * vaultPercentage) / 100;
        poolSupply = TOKEN_SUPPLY - vaultSupply;

        // Lock up the vault allocation for the admin
        IERC20(token).approve(address(vault), vaultSupply);
        vault.deposit(token, vaultSupply, block.timestamp + vaultDuration, vaultAllocationAdmin);
    }

    // Lock the lp tokens and add the user reward recipient to the liquidity locker
    function _lockLPTokens(uint256 positionId, RewardsConfig memory rewardsConfig) internal {
        // ensure the creator reward is not greater than the max creator reward or zero
        if (rewardsConfig.creatorReward > MAX_CREATOR_REWARD || rewardsConfig.creatorReward == 0) {
            revert InvalidCreatorReward();
        }

        // ensure that the creator admin is set
        if (rewardsConfig.creatorAdmin == address(0)) {
            revert InvalidCreatorInfo();
        }

        // if the creator reward is not max, ensure the interface admin is set
        if (
            rewardsConfig.creatorReward < MAX_CREATOR_REWARD
                && rewardsConfig.interfaceAdmin == address(0)
        ) {
            revert InvalidInterfaceInfo();
        }

        // transfer the lp position to the liquidity locker
        positionManager.safeTransferFrom(address(this), address(liquidityLocker), positionId);

        // add the user reward recipient to the liquidity locker
        liquidityLocker.addTokenReward(
            ILpLockerv2.TokenRewardInfo({
                lpTokenId: positionId,
                creatorReward: rewardsConfig.creatorReward,
                creator: ILpLockerv2.RewardRecipient({
                    admin: rewardsConfig.creatorAdmin,
                    recipient: rewardsConfig.creatorRewardRecipient
                }),
                interfacer: ILpLockerv2.RewardRecipient({
                    admin: rewardsConfig.interfaceAdmin,
                    recipient: rewardsConfig.interfaceRewardRecipient
                })
            })
        );
    }

    function _configurePool(
        address newToken,
        address pairedToken,
        int24 tickIfToken0IsNewToken,
        uint256 supplyPerPool
    ) internal returns (uint256 positionId) {
        // check tick spacing
        if (tickIfToken0IsNewToken % TICK_SPACING != 0) {
            revert InvalidTick();
        }

        // Pool ordering
        bool token0IsNewToken = newToken < pairedToken;

        // flip tick if token0 is not the new token
        int24 tick = token0IsNewToken ? tickIfToken0IsNewToken : -tickIfToken0IsNewToken;

        uint160 sqrtPriceX96 = tick.getSqrtRatioAtTick();

        // Create pool
        address pool = uniswapV3Factory.createPool(newToken, pairedToken, POOL_FEE);

        // Initialize pool
        IUniswapV3Pool(pool).initialize(sqrtPriceX96);

        INonfungiblePositionManager.MintParams memory params = INonfungiblePositionManager
            .MintParams(
            token0IsNewToken ? newToken : pairedToken,
            token0IsNewToken ? pairedToken : newToken,
            POOL_FEE,
            token0IsNewToken ? tick : -MAX_TICK,
            token0IsNewToken ? MAX_TICK : tick,
            token0IsNewToken ? supplyPerPool : 0,
            token0IsNewToken ? 0 : supplyPerPool,
            0,
            0,
            address(this),
            block.timestamp
        );
        (positionId,,,) = positionManager.mint(params);
    }

    function _initialBuy(
        address token,
        address pairedToken,
        uint24 pairedTokenPoolFee,
        uint256 pairedTokenSwapAmountOutMinimum,
        address recipient
    ) internal returns (uint256 amountTokensBought) {
        // amount in is the amount of eth sent to perform the intial buy with
        uint256 pairedTokenAmountIn = msg.value;

        // if the paired token is not weth, we need to swap from weth to paired token
        if (pairedToken != weth) {
            // swap from weth to paired token
            ISwapRouter.ExactInputSingleParams memory swapParams = ISwapRouter
                .ExactInputSingleParams({
                tokenIn: weth, // The token we are exchanging from (ETH wrapped as WETH)
                tokenOut: pairedToken, // The token we are exchanging to
                fee: pairedTokenPoolFee, // The pool fee
                recipient: address(this), // The recipient address
                amountIn: msg.value, // The amount of ETH (WETH) to be swapped
                amountOutMinimum: pairedTokenSwapAmountOutMinimum, // Minimum amount to receive
                sqrtPriceLimitX96: 0 // No price limit
            });

            // execute the swap to get pair tokens for the initial buy
            pairedTokenAmountIn = swapRouter.exactInputSingle{value: msg.value}(swapParams);

            // approve the swap router to spend the paired token
            IERC20(pairedToken).approve(address(swapRouter), pairedTokenAmountIn);
        }

        // swap from paired token to token
        ISwapRouter.ExactInputSingleParams memory swapParamsToken = ISwapRouter
            .ExactInputSingleParams({
            tokenIn: pairedToken, // The token we are exchanging from
            tokenOut: token, // The token we are exchanging to
            fee: POOL_FEE, // The pool fee
            recipient: recipient, // The recipient address
            amountIn: pairedTokenAmountIn, // The amount of paired token to be swapped
            amountOutMinimum: 0, // Minimum amount to receive
            sqrtPriceLimitX96: 0 // No price limit
        });

        // execute the swap
        amountTokensBought =
            swapRouter.exactInputSingle{value: pairedToken == weth ? msg.value : 0}(swapParamsToken);
    }
}
