// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockAIOracle
 * @notice Mock oracle untuk AI trust score (testing)
 */
contract MockAIOracle is Ownable {
    
    mapping(address => uint256) public trustScores;
    mapping(address => bool) public isProcessing;
    
    event TrustScoreRequested(address indexed user);
    event TrustScoreUpdated(address indexed user, uint256 score);
    
    constructor() Ownable(msg.sender) {}
    
    function requestTrustScore(address user) external {
        isProcessing[user] = true;
        emit TrustScoreRequested(user);
    }
    
    function updateTrustScore(address user, uint256 score) external onlyOwner {
        require(score <= 100, "Invalid score");
        trustScores[user] = score;
        isProcessing[user] = false;
        emit TrustScoreUpdated(user, score);
    }
    
    function getTrustScore(address user) external view returns (uint256) {
        return trustScores[user];
    }
}