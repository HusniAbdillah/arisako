// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IArisanPool {
    function joinPool() external;
    function contribute() external;
    function getMemberCount() external view returns (uint256);
    function getPoolInfo() external view returns (
        string memory name,
        uint256 contribution,
        uint256 maxMem,
        uint256 currentMem,
        uint256 currentRnd,
        uint8 state
    );
}