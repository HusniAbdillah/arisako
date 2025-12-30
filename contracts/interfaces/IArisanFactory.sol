// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IArisanFactory {
    enum PoolStatus { PENDING, ACTIVE, COMPLETED, CANCELLED }

    function updatePoolStatus(address poolAddress, PoolStatus newStatus) external;
    function registerMember(address poolAddress, address member) external;
    function updateTVL(address poolAddress, uint256 newTVL) external;
    function checkMembership(address user, address poolAddress) external view returns (bool);
}