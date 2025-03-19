// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

interface ILpLockerv2 is IERC721Receiver {
    error NotAllowed(address user);
    error AlreadyKnownTokenId(uint256 tokenId);
    error InvalidCreatorReward(uint256 creatorReward);
    error MaxCreatorRewardNotSet();
    error InvalidMaxCreatorReward();
    error InvalidTeamRecipient();

    event ClaimedRewards(
        uint256 indexed lpTokenId,
        address indexed creatorRecipient,
        address indexed interfaceRecipient,
        address teamRecipient,
        address token0,
        address token1,
        uint256 creatorReward0,
        uint256 creatorReward1,
        uint256 interfaceReward0,
        uint256 interfaceReward1,
        uint256 teamReward0,
        uint256 teamReward1
    );

    event Received(address indexed from, uint256 tokenId);

    event CreatorRewardRecipientUpdated(
        uint256 indexed lpTokenId, address indexed oldRecipient, address newRecipient
    );
    event CreatorRewardRecipientAdminUpdated(
        uint256 indexed lpTokenId, address indexed oldAdmin, address newAdmin
    );

    event InterfaceRewardRecipientUpdated(
        uint256 indexed lpTokenId, address indexed oldRecipient, address newRecipient
    );
    event InterfaceRewardRecipientAdminUpdated(
        uint256 indexed lpTokenId, address indexed oldAdmin, address newAdmin
    );

    event TeamOverrideRewardRecipientUpdated(
        uint256 indexed lpTokenId, address indexed oldRecipient, address newRecipient
    );
    event TeamRecipientUpdated(address indexed oldRecipient, address newRecipient);

    event TokenRewardAdded(
        uint256 lpTokenId,
        uint256 creatorReward,
        address indexed creator,
        address indexed interfacer
    );

    struct RewardRecipient {
        address admin;
        address recipient;
    }

    struct TokenRewardInfo {
        uint256 lpTokenId;
        uint256 creatorReward;
        RewardRecipient creator;
        RewardRecipient interfacer;
    }

    function TEAM_REWARD() external pure returns (uint256);
    function MAX_CREATOR_REWARD() external view returns (uint256);

    function teamRecipient() external view returns (address);
    function tokenRewards(uint256)
        external
        view
        returns (
            uint256 lpTokenId,
            uint256 creatorReward,
            RewardRecipient memory creator,
            RewardRecipient memory interfacer
        );
    function teamOverrideRewardRecipientForToken(uint256) external view returns (address);
    function creatorTokenIds(address, uint256) external view returns (uint256);
    function setOverrideTeamRewardRecipientForToken(uint256 tokenId, address newTeamRecipient)
        external;

    function addTokenReward(TokenRewardInfo memory tokenRewardInfo) external;
    function collectRewards(uint256 tokenId) external;
    function getLpTokenIdsForCreator(address user) external view returns (uint256[] memory);

    function updateTeamRecipient(address newRecipient) external;

    function updateCreatorRewardRecipient(uint256 tokenId, address newRecipient) external;
    function updateInterfaceRewardRecipient(uint256 tokenId, address newRecipient) external;
    function updateInterfaceRewardAdmin(uint256 tokenId, address newAdmin) external;
    function updateCreatorRewardAdmin(uint256 tokenId, address newAdmin) external;

    function withdrawETH(address recipient) external;
    function withdrawERC20(address token, address recipient) external;
}
