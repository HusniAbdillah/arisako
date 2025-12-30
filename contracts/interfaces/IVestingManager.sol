// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IVestingManager {
    function createVesting(
        address beneficiary,
        uint256 amount,
        uint256 duration,
        bool isRevocable
    ) external returns (bytes32);

    function claim(bytes32 vestingId) external;
    function getClaimable(bytes32 vestingId) external view returns (uint256);
}