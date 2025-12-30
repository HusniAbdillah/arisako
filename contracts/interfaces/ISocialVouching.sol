// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ISocialVouching {
    function vouchFor(address vouchee, uint256 weight, string calldata message) external;
    function revokeVouch(address vouchee) external;
    function getTrustScore(address user) external view returns (uint256);
    function isVerified(address user) external view returns (bool);
}