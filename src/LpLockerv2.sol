// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IClanker} from "./interfaces/IClanker.sol";
import {ILpLockerv2} from "./interfaces/ILpLockerv2.sol";
import {INonfungiblePositionManager} from "./interfaces/uniswapv3.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

contract LpLockerv2 is Ownable, ILpLockerv2 {
    string public constant version = "0.0.2";

    address public positionManager;
    address public factory;

    uint256 public constant TEAM_REWARD = 20;
    uint256 public immutable MAX_CREATOR_REWARD;
    address public teamRecipient;

    mapping(uint256 => TokenRewardInfo) public tokenRewards;
    mapping(uint256 => address) public teamOverrideRewardRecipientForToken;

    mapping(address => uint256[]) public creatorTokenIds;

    constructor(
        address owner_, // owner of the contract
        address tokenFactory_, // Address of the clanker factory
        address positionManager_, // Address of the position manager
        address teamRecipient_ // address to receive team portion of the rewards
    ) Ownable(owner_) {
        factory = tokenFactory_;
        positionManager = positionManager_;
        teamRecipient = teamRecipient_;

        // match the factory's max creator reward
        MAX_CREATOR_REWARD = IClanker(factory).MAX_CREATOR_REWARD();
        if (MAX_CREATOR_REWARD == 0) {
            revert MaxCreatorRewardNotSet();
        }
        // ensure the max creator reward and team reward add up to 100
        if (MAX_CREATOR_REWARD + TEAM_REWARD != 100) {
            revert InvalidMaxCreatorReward();
        }

        // ensure the team recipient is not the zero address
        if (teamRecipient == address(0)) {
            revert InvalidTeamRecipient();
        }
    }

    modifier onlyFactory() {
        if (msg.sender != factory) {
            revert NotAllowed(msg.sender);
        }
        _;
    }

    // Set the override team reward recipient for a token
    function setOverrideTeamRewardRecipientForToken(uint256 tokenId, address newTeamRecipient)
        external
    {
        if (msg.sender != owner() && msg.sender != factory) {
            revert NotAllowed(msg.sender);
        }

        address oldTeamRecipient = teamOverrideRewardRecipientForToken[tokenId];
        teamOverrideRewardRecipientForToken[tokenId] = newTeamRecipient;

        emit TeamOverrideRewardRecipientUpdated(tokenId, oldTeamRecipient, newTeamRecipient);
    }

    // Update the default team recipient
    function updateTeamRecipient(address newRecipient) external onlyOwner {
        address oldTeamRecipient = teamRecipient;
        teamRecipient = newRecipient;

        // ensure the team recipient is not the zero address
        if (teamRecipient == address(0)) {
            revert InvalidTeamRecipient();
        }
        emit TeamRecipientUpdated(oldTeamRecipient, newRecipient);
    }

    // Add a token reward, this is called by the factory when a token is created
    function addTokenReward(TokenRewardInfo memory tokenRewardInfo) external onlyFactory {
        // check that the token id is not already known
        if (tokenRewards[tokenRewardInfo.lpTokenId].lpTokenId != 0) {
            revert AlreadyKnownTokenId(tokenRewardInfo.lpTokenId);
        }

        // check that the creator reward is not greater than the max creator reward or zero
        if (
            tokenRewardInfo.creatorReward > MAX_CREATOR_REWARD || tokenRewardInfo.creatorReward == 0
        ) {
            revert InvalidCreatorReward(tokenRewardInfo.creatorReward);
        }

        tokenRewards[tokenRewardInfo.lpTokenId] = tokenRewardInfo;
        creatorTokenIds[tokenRewardInfo.creator.admin].push(tokenRewardInfo.lpTokenId);

        emit TokenRewardAdded(
            tokenRewardInfo.lpTokenId,
            tokenRewardInfo.creatorReward,
            tokenRewardInfo.creator.admin,
            tokenRewardInfo.interfacer.admin
        );
    }

    // Collect rewards for a token
    function collectRewards(uint256 tokenId) public {
        address teamRecipient_ = teamOverrideRewardRecipientForToken[tokenId];
        if (teamRecipient_ == address(0)) {
            teamRecipient_ = teamRecipient;
        }

        address creatorRecipient_ = tokenRewards[tokenId].creator.recipient;
        if (creatorRecipient_ == address(0)) {
            creatorRecipient_ = teamRecipient_;
        }

        address interfaceRecipient_ = tokenRewards[tokenId].interfacer.recipient;
        if (interfaceRecipient_ == address(0)) {
            interfaceRecipient_ = teamRecipient_;
        }

        // collect the rewards
        INonfungiblePositionManager nonfungiblePositionManager =
            INonfungiblePositionManager(positionManager);

        (uint256 amount0, uint256 amount1) = nonfungiblePositionManager.collect(
            INonfungiblePositionManager.CollectParams({
                recipient: address(this),
                amount0Max: type(uint128).max,
                amount1Max: type(uint128).max,
                tokenId: tokenId
            })
        );

        (,, address token0, address token1,,,,,,,,) = nonfungiblePositionManager.positions(tokenId);

        IERC20 rewardToken0 = IERC20(token0);
        IERC20 rewardToken1 = IERC20(token1);
        uint256 creatorReward = tokenRewards[tokenId].creatorReward;

        // figure out the rewards distribution
        uint256 teamReward0 = (amount0 * TEAM_REWARD) / 100;
        uint256 teamReward1 = (amount1 * TEAM_REWARD) / 100;
        rewardToken0.transfer(teamRecipient_, teamReward0);
        rewardToken1.transfer(teamRecipient_, teamReward1);

        uint256 interfaceReward0;
        uint256 interfaceReward1;
        uint256 creatorReward0;
        uint256 creatorReward1;

        if (creatorReward == MAX_CREATOR_REWARD) {
            // if the creator reward is max, then there is no interface reward
            creatorReward0 = amount0 - teamReward0;
            creatorReward1 = amount1 - teamReward1;

            rewardToken0.transfer(creatorRecipient_, creatorReward0);
            rewardToken1.transfer(creatorRecipient_, creatorReward1);
        } else {
            // we have both a creator and interface reward
            creatorReward0 = (amount0 * creatorReward) / 100;
            creatorReward1 = (amount1 * creatorReward) / 100;

            interfaceReward0 = amount0 - teamReward0 - creatorReward0;
            interfaceReward1 = amount1 - teamReward1 - creatorReward1;

            rewardToken0.transfer(interfaceRecipient_, interfaceReward0);
            rewardToken1.transfer(interfaceRecipient_, interfaceReward1);

            rewardToken0.transfer(creatorRecipient_, creatorReward0);
            rewardToken1.transfer(creatorRecipient_, creatorReward1);
        }

        emit ClaimedRewards({
            lpTokenId: tokenId,
            creatorRecipient: creatorRecipient_,
            interfaceRecipient: interfaceRecipient_,
            teamRecipient: teamRecipient_,
            token0: token0,
            token1: token1,
            teamReward0: teamReward0,
            teamReward1: teamReward1,
            interfaceReward0: interfaceReward0,
            interfaceReward1: interfaceReward1,
            creatorReward0: creatorReward0,
            creatorReward1: creatorReward1
        });
    }

    // Get the token ids for a creator (using the admin address)
    function getLpTokenIdsForCreator(address user) public view returns (uint256[] memory) {
        return creatorTokenIds[user];
    }

    // Replace the creator reward recipient
    function updateCreatorRewardRecipient(uint256 tokenId, address newRecipient) external {
        TokenRewardInfo memory tokenRewardInfo = tokenRewards[tokenId];

        // Only admin can replace the reward recipient
        if (msg.sender != tokenRewardInfo.creator.admin) {
            revert NotAllowed(msg.sender);
        }

        // Add the new recipient
        address oldRecipient = tokenRewards[tokenId].creator.recipient;
        tokenRewards[tokenId].creator.recipient = newRecipient;

        emit CreatorRewardRecipientUpdated(tokenId, oldRecipient, newRecipient);
    }

    // Replace the interface reward recipient
    function updateInterfaceRewardRecipient(uint256 tokenId, address newRecipient) external {
        TokenRewardInfo memory tokenRewardInfo = tokenRewards[tokenId];

        // Only admin can replace the reward recipient
        if (msg.sender != tokenRewardInfo.interfacer.admin) {
            revert NotAllowed(msg.sender);
        }

        // Add the new recipient
        address oldRecipient = tokenRewards[tokenId].interfacer.recipient;
        tokenRewards[tokenId].interfacer.recipient = newRecipient;

        emit InterfaceRewardRecipientUpdated(tokenId, oldRecipient, newRecipient);
    }

    // Replace the interface reward admin
    function updateInterfaceRewardAdmin(uint256 tokenId, address newAdmin) external {
        TokenRewardInfo memory tokenRewardInfo = tokenRewards[tokenId];

        // Only admin can replace the reward admin
        if (msg.sender != tokenRewardInfo.interfacer.admin) {
            revert NotAllowed(msg.sender);
        }

        // Add the new admin
        address oldAdmin = tokenRewards[tokenId].interfacer.admin;
        tokenRewards[tokenId].interfacer.admin = newAdmin;

        emit InterfaceRewardRecipientAdminUpdated(tokenId, oldAdmin, newAdmin);
    }

    // Replace the creator reward admin
    function updateCreatorRewardAdmin(uint256 tokenId, address newAdmin) external {
        TokenRewardInfo memory tokenRewardInfo = tokenRewards[tokenId];

        // Only admin can replace the admin
        if (msg.sender != tokenRewardInfo.creator.admin) {
            revert NotAllowed(msg.sender);
        }

        // Remove the tokenId from _creatorTokenIds
        uint256 length = creatorTokenIds[tokenRewardInfo.creator.admin].length;
        for (uint256 i = 0; i < length; i++) {
            if (creatorTokenIds[tokenRewardInfo.creator.admin][i] == tokenRewardInfo.lpTokenId) {
                // Swap with the last element
                creatorTokenIds[tokenRewardInfo.creator.admin][i] =
                    creatorTokenIds[tokenRewardInfo.creator.admin][length - 1];
                // Pop the last element
                creatorTokenIds[tokenRewardInfo.creator.admin].pop();
                break;
            }
        }

        // push the token id to the new admin
        creatorTokenIds[newAdmin].push(tokenRewardInfo.lpTokenId);

        address oldAdmin = tokenRewards[tokenId].creator.admin;
        tokenRewards[tokenId].creator.admin = newAdmin;

        emit CreatorRewardRecipientAdminUpdated(tokenId, oldAdmin, newAdmin);
    }

    // Enable contract to receive LP Tokens
    function onERC721Received(address, address from, uint256 id, bytes calldata)
        external
        override
        returns (bytes4)
    {
        // Only Clanker Factory can send NFTs here
        if (from != factory) {
            revert NotAllowed(from);
        }

        emit Received(from, id);
        return IERC721Receiver.onERC721Received.selector;
    }

    // Withdraw ETH from the contract
    function withdrawETH(address recipient) public onlyOwner {
        payable(recipient).transfer(address(this).balance);
    }

    // Withdraw ERC20 tokens from the contract
    function withdrawERC20(address token, address recipient) public onlyOwner {
        IERC20 token_ = IERC20(token);
        token_.transfer(recipient, token_.balanceOf(address(this)));
    }
}
