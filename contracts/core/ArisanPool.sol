// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IArisanFactory.sol";

/**
 * @title ArisanPool
 * @notice Main contract untuk satu grup arisan
 */
contract ArisanPool is ReentrancyGuard, Ownable {

    struct Member {
        address memberAddress;
        uint256 joinedAt;
        uint256 totalContributed;
        uint256 lastContributionTime;
        bool hasReceivedPayout;
        uint256 payoutRound;
        bool isActive;
        uint256 vouchScore;
    }

    struct Round {
        uint256 roundNumber;
        address recipient;
        uint256 amount;
        uint256 timestamp;
        bool isPaid;
    }

    enum PoolState { Recruiting, Active, Completed, Cancelled }

    string public poolName;
    uint256 public contributionAmount;
    uint256 public maxMembers;
    uint256 public cycleDuration;
    uint256 public ujrahRate;
    
    address public immutable IDRX_TOKEN;
    address public immutable FACTORY;
    
    address[] public memberList;
    mapping(address => Member) public members;
    mapping(uint256 => Round) public rounds;
    
    uint256 public currentRound;
    uint256 public poolStartTime;
    uint256 public totalPoolBalance;
    
    PoolState public poolState;

    event MemberJoined(address indexed member, uint256 timestamp);
    event ContributionMade(address indexed member, uint256 amount, uint256 round);
    event PayoutDistributed(address indexed recipient, uint256 amount, uint256 round);
    event PoolStarted(uint256 timestamp);
    event PoolCompleted(uint256 timestamp);
    event PoolCancelled(uint256 timestamp);

    constructor(
        string memory _name,
        uint256 _contributionAmount,
        uint256 _maxMembers,
        uint256 _cycleDuration,
        uint256 _ujrahRate,
        address _idrxToken,
        address _factory
    ) Ownable(msg.sender) {
        poolName = _name;
        contributionAmount = _contributionAmount;
        maxMembers = _maxMembers;
        cycleDuration = _cycleDuration;
        ujrahRate = _ujrahRate;
        IDRX_TOKEN = _idrxToken;
        FACTORY = _factory;
        
        poolState = PoolState.Recruiting;
        currentRound = 0;
    }

    function joinPool() external nonReentrant {
        require(poolState == PoolState.Recruiting, "Pool not recruiting");
        require(memberList.length < maxMembers, "Pool is full");
        require(! members[msg.sender].isActive, "Already a member");
        
        members[msg.sender] = Member({
            memberAddress: msg.sender,
            joinedAt: block.timestamp,
            totalContributed: 0,
            lastContributionTime: 0,
            hasReceivedPayout: false,
            payoutRound: 0,
            isActive: true,
            vouchScore: 100
        });
        
        memberList.push(msg.sender);
        
        IArisanFactory(FACTORY).registerMember(address(this), msg.sender);
        
        emit MemberJoined(msg.sender, block.timestamp);
        
        if (memberList.length == maxMembers) {
            _startPool();
        }
    }

    function contribute() external nonReentrant {
        require(poolState == PoolState.Active, "Pool not active");
        require(members[msg.sender].isActive, "Not a member");
        
        require(currentRound < maxMembers, "All rounds completed");
        
        bool success = IERC20(IDRX_TOKEN).transferFrom(
            msg.sender,
            address(this),
            contributionAmount
        );
        require(success, "Transfer failed");
        
        members[msg.sender].totalContributed += contributionAmount;
        members[msg.sender].lastContributionTime = block.timestamp;
        totalPoolBalance += contributionAmount;
        
        IArisanFactory(FACTORY).updateTVL(address(this), totalPoolBalance);
        
        emit ContributionMade(msg.sender, contributionAmount, currentRound);
        
        _checkAndDistributePayout();
    }

    function selectNextRecipient(address _recipient) external onlyOwner {
        require(poolState == PoolState.Active, "Pool not active");
        require(members[_recipient].isActive, "Not a member");
        require(!members[_recipient].hasReceivedPayout, "Already received");
        
        members[_recipient].hasReceivedPayout = true;
        members[_recipient].payoutRound = currentRound;
        
        rounds[currentRound] = Round({
            roundNumber: currentRound,
            recipient: _recipient,
            amount: 0,
            timestamp: block.timestamp,
            isPaid: false
        });
    }

    function emergencyWithdraw() external nonReentrant {
        require(poolState == PoolState.Cancelled, "Pool not cancelled");
        require(members[msg.sender].isActive, "Not a member");
        
        uint256 refundAmount = members[msg.sender].totalContributed;
        require(refundAmount > 0, "Nothing to refund");
        
        members[msg.sender].totalContributed = 0;
        
        bool success = IERC20(IDRX_TOKEN).transfer(msg.sender, refundAmount);
        require(success, "Refund failed");
    }

    function _startPool() internal {
        poolState = PoolState.Active;
        poolStartTime = block.timestamp;
        currentRound = 1;

        IArisanFactory(FACTORY).updatePoolStatus(
            address(this),
            IArisanFactory.PoolStatus.ACTIVE
        );

        emit PoolStarted(block.timestamp);
    }

    function _checkAndDistributePayout() internal {
        uint256 expectedContributions = memberList.length * contributionAmount;
        
        if (totalPoolBalance >= expectedContributions) {
            Round storage round = rounds[currentRound];
            require(round.recipient != address(0), "No recipient selected");
            require(!round.isPaid, "Already paid");
            
            uint256 ujrahAmount = (expectedContributions * ujrahRate) / 10000;
            uint256 payoutAmount = expectedContributions - ujrahAmount;
            
            round.amount = payoutAmount;
            round.isPaid = true;
            
            totalPoolBalance -= expectedContributions;
            
            bool success = IERC20(IDRX_TOKEN).transfer(round.recipient, payoutAmount);
            require(success, "Payout failed");
            
            if (ujrahAmount > 0) {
                IERC20(IDRX_TOKEN).transfer(owner(), ujrahAmount);
            }
            
            emit PayoutDistributed(round.recipient, payoutAmount, currentRound);
            
            currentRound++;
            
            if (currentRound > maxMembers) {
                _completePool();
            }
        }
    }

    function _completePool() internal {
        poolState = PoolState.Completed;

        IArisanFactory(FACTORY).updatePoolStatus(
            address(this),
            IArisanFactory.PoolStatus.COMPLETED
        );

        emit PoolCompleted(block.timestamp);
    }

    function _getCurrentExpectedRound() internal view returns (uint256) {
        if (poolStartTime == 0) return 0;
        return ((block.timestamp - poolStartTime) / cycleDuration) + 1;
    }

    function getMemberCount() external view returns (uint256) {
        return memberList.length;
    }
    
    function getMemberInfo(address _member) external view returns (Member memory) {
        return members[_member];
    }
    
    function getRoundInfo(uint256 _round) external view returns (Round memory) {
        return rounds[_round];
    }
    
    function getAllMembers() external view returns (address[] memory) {
        return memberList;
    }
    
    function getPoolInfo() external view returns (
        string memory name,
        uint256 contribution,
        uint256 maxMem,
        uint256 currentMem,
        uint256 currentRnd,
        PoolState state
    ) {
        return (
            poolName,
            contributionAmount,
            maxMembers,
            memberList.length,
            currentRound,
            poolState
        );
    }
}