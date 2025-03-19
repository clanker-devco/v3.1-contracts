// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IClankerVault} from "./interfaces/IClankerVault.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract ClankerVault is Ownable, ReentrancyGuard, IClankerVault {
    address public factory;
    uint256 public minimumVaultTime;

    mapping(address => Allocation) public allocation;

    struct Allocation {
        address token;
        uint256 amount;
        uint256 endTime;
        address admin;
    }

    modifier onlyFactory() {
        if (msg.sender != factory) revert Unauthorized();
        _;
    }

    constructor(address owner, address factory_, uint256 minimumVaultTime_) Ownable(owner) {
        factory = factory_;
        minimumVaultTime = minimumVaultTime_;
    }

    function editMinimumVaultTime(uint256 newMinimumVaultTime) external onlyOwner {
        uint256 oldMinimumVaultTime = minimumVaultTime;
        minimumVaultTime = newMinimumVaultTime;
        emit MinimumVaultTimeUpdated(oldMinimumVaultTime, newMinimumVaultTime);
    }

    function deposit(address token, uint256 amount, uint256 endTime, address admin)
        external
        nonReentrant
        onlyFactory
    {
        if (endTime < block.timestamp + minimumVaultTime) {
            revert InvalidVaultTime();
        }

        // only one allocation per token
        if (allocation[token].endTime != 0) revert AllocationAlreadyExists();

        allocation[token] =
            Allocation({token: token, amount: amount, endTime: endTime, admin: admin});

        IERC20(token).transferFrom(msg.sender, address(this), amount);

        emit AllocationCreated(token, admin, amount, endTime);
    }

    function editAllocationAdmin(address token, address newAdmin) external {
        if (msg.sender != allocation[token].admin) revert Unauthorized();
        allocation[token].admin = newAdmin;

        emit AllocationAdminUpdated(token, msg.sender, newAdmin);
    }

    function withdraw(address token, uint256 amount, address to) external nonReentrant {
        if (msg.sender != allocation[token].admin) revert Unauthorized();
        if (block.timestamp < allocation[token].endTime) {
            revert AllocationNotUnlocked();
        }
        if (allocation[token].amount < amount) revert NotEnoughBalance();

        allocation[token].amount -= amount;
        IERC20(token).transfer(to, amount);

        emit AllocationUnlocked(token, amount, allocation[token].amount);
    }
}
