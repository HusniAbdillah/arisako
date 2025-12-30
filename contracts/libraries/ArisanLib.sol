// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ArisanLib
 * @notice Library helper functions arisan
 */
library ArisanLib {

    function calculateUjrah(uint256 amount, uint256 rate) 
        internal 
        pure 
        returns (uint256) 
    {
        return (amount * rate) / 10000;
    }

    function calculatePayout(uint256 totalAmount, uint256 ujrahRate) 
        internal 
        pure 
        returns (uint256 payout, uint256 ujrah) 
    {
        ujrah = calculateUjrah(totalAmount, ujrahRate);
        payout = totalAmount - ujrah;
    }

    function isValidMemberRange(uint256 members) 
        internal 
        pure 
        returns (bool) 
    {
        return members >= 5 && members <= 20;
    }

    function isValidUjrahRate(uint256 rate) 
        internal 
        pure 
        returns (bool) 
    {
        return rate <= 500;
    }

    function calculateRound(uint256 startTime, uint256 cycleDuration) 
        internal 
        view 
        returns (uint256) 
    {
        if (startTime == 0 || block.timestamp < startTime) return 0;
        return ((block.timestamp - startTime) / cycleDuration) + 1;
    }
}