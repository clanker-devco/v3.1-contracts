// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IClankerVault {
    event MinimumVaultTimeUpdated(uint256 oldVaultTime, uint256 newVaultTime);

    event AllocationCreated(
        address indexed token, address indexed admin, uint256 amount, uint256 unlockTime
    );

    event AllocationAdminUpdated(
        address indexed token, address indexed oldAdmin, address indexed newAdmin
    );

    event AllocationUnlocked(address indexed token, uint256 amount, uint256 remainingAmount);

    error Unauthorized();
    error NotEnoughBalance();
    error AllocationNotUnlocked();
    error InvalidVaultTime();
    error AllocationAlreadyExists();

    function allocation(address token)
        external
        view
        returns (address tokenAddress, uint256 amount, uint256 endTime, address admin);

    function factory() external view returns (address);
    function minimumVaultTime() external view returns (uint256);
    function editMinimumVaultTime(uint256 newMinimumVaultTime) external;
    function deposit(address token, uint256 amount, uint256 endTime, address admin) external;
    function editAllocationAdmin(address token, address newAdmin) external;
    function withdraw(address token, uint256 amount, address to) external;
}
