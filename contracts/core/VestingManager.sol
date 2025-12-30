 
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title VestingManager
 * @notice Mengelola vesting untuk payout arisan
 */
contract VestingManager is Ownable, ReentrancyGuard {

    struct VestingSchedule {
        address beneficiary;
        uint256 totalAmount;
        uint256 startTime;
        uint256 duration;
        uint256 claimedAmount;
        bool isActive;
        bool isRevocable;
    }

    mapping(bytes32 => VestingSchedule) public vestingSchedules;
    mapping(address => bytes32[]) public userVestings;
    
    address public immutable TOKEN;
    uint256 public totalVestingAmount;

    event VestingCreated(
        bytes32 indexed vestingId,
        address indexed beneficiary,
        uint256 amount,
        uint256 duration
    );
    
    event VestingClaimed(
        bytes32 indexed vestingId,
        address indexed beneficiary,
        uint256 amount
    );
    
    event VestingRevoked(bytes32 indexed vestingId);

    constructor(address _token) Ownable(msg.sender) {
        require(_token != address(0), "Invalid token");
        TOKEN = _token;
    }

    function createVesting(
        address _beneficiary,
        uint256 _amount,
        uint256 _duration,
        bool _isRevocable
    ) external nonReentrant returns (bytes32) {
        require(_beneficiary != address(0), "Invalid beneficiary");
        require(_amount > 0, "Invalid amount");
        require(_duration > 0, "Invalid duration");
        
        bool success = IERC20(TOKEN).transferFrom(msg.sender, address(this), _amount);
        require(success, "Transfer failed");
        
        bytes32 vestingId = keccak256(
            abi.encodePacked(_beneficiary, block.timestamp, _amount)
        );
        
        vestingSchedules[vestingId] = VestingSchedule({
            beneficiary: _beneficiary,
            totalAmount: _amount,
            startTime: block.timestamp,
            duration: _duration,
            claimedAmount: 0,
            isActive: true,
            isRevocable: _isRevocable
        });
        
        userVestings[_beneficiary].push(vestingId);
        totalVestingAmount += _amount;
        
        emit VestingCreated(vestingId, _beneficiary, _amount, _duration);
        
        return vestingId;
    }

    function claim(bytes32 _vestingId) external nonReentrant {
        VestingSchedule storage schedule = vestingSchedules[_vestingId];
        require(schedule.isActive, "Vesting not active");
        require(schedule.beneficiary == msg.sender, "Not beneficiary");
        
        uint256 claimable = _calculateClaimable(_vestingId);
        require(claimable > 0, "Nothing to claim");
        
        schedule.claimedAmount += claimable;
        
        if (schedule.claimedAmount >= schedule.totalAmount) {
            schedule.isActive = false;
            totalVestingAmount -= schedule.totalAmount;
        }
        
        bool success = IERC20(TOKEN).transfer(msg.sender, claimable);
        require(success, "Transfer failed");
        
        emit VestingClaimed(_vestingId, msg.sender, claimable);
    }

    function revokeVesting(bytes32 _vestingId) external onlyOwner {
        VestingSchedule storage schedule = vestingSchedules[_vestingId];
        require(schedule.isActive, "Vesting not active");
        require(schedule.isRevocable, "Not revocable");
        
        uint256 remaining = schedule.totalAmount - schedule.claimedAmount;
        schedule.isActive = false;
        totalVestingAmount -= schedule.totalAmount;
        
        if (remaining > 0) {
            IERC20(TOKEN).transfer(owner(), remaining);
        }
        
        emit VestingRevoked(_vestingId);
    }

    function _calculateClaimable(bytes32 _vestingId) internal view returns (uint256) {
        VestingSchedule memory schedule = vestingSchedules[_vestingId];
        
        if (!schedule.isActive) return 0;
        
        uint256 elapsed = block.timestamp - schedule.startTime;
        
        if (elapsed >= schedule.duration) {
            return schedule.totalAmount - schedule.claimedAmount;
        }
        
        uint256 vested = (schedule.totalAmount * elapsed) / schedule.duration;
        return vested - schedule.claimedAmount;
    }

    function getClaimable(bytes32 _vestingId) external view returns (uint256) {
        return _calculateClaimable(_vestingId);
    }
    
    function getUserVestings(address _user) external view returns (bytes32[] memory) {
        return userVestings[_user];
    }
    
    function getVestingInfo(bytes32 _vestingId) 
        external 
        view 
        returns (VestingSchedule memory) 
    {
        return vestingSchedules[_vestingId];
    }
}