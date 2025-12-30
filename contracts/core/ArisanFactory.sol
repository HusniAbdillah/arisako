// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./ArisanPool.sol";

/**
 * @title ArisanFactory
 * @notice Factory contract untuk membuat dan mengelola Arisan Pools
 * @dev Menggunakan pattern Factory untuk deploy multiple pool instances
 */
contract ArisanFactory is Ownable, ReentrancyGuard {

    struct PoolConfig {
        string name;
        uint256 contributionAmount;
        uint256 maxMembers;
        uint256 cycleDuration;
        uint256 ujrahRate;
        bool requiresVouching;
        uint256 minVouchScore;
    }

    struct PoolMetadata {
        address poolAddress;
        address creator;
        uint256 createdAt;
        uint256 currentMembers;
        PoolStatus status;
        uint256 totalValueLocked;
    }

    enum PoolStatus { PENDING, ACTIVE, COMPLETED, CANCELLED }

    address[] public allPools;
    mapping(address => PoolMetadata) public poolMetadata;
    mapping(address => address[]) public poolsByCreator;
    mapping(address => mapping(address => bool)) public isMemberOfPool;

    address public immutable IDRX_TOKEN;
    address public vestingManager;
    address public socialVouching;
    uint256 public deploymentFee;
    address public treasury;

    event PoolCreated(
        address indexed poolAddress,
        address indexed creator,
        string name,
        uint256 maxMembers,
        uint256 contributionAmount
    );
    
    event PoolStatusUpdated(
        address indexed poolAddress,
        PoolStatus oldStatus,
        PoolStatus newStatus
    );
    
    event MemberJoined(
        address indexed poolAddress,
        address indexed member,
        uint256 timestamp
    );
    
    event DeploymentFeeUpdated(uint256 oldFee, uint256 newFee);

    constructor(
        address _idrxToken,
        address _treasury,
        uint256 _deploymentFee
    ) Ownable(msg.sender) {
        require(_idrxToken != address(0), "Invalid IDRX address");
        require(_treasury != address(0), "Invalid treasury address");
        
        IDRX_TOKEN = _idrxToken;
        treasury = _treasury;
        deploymentFee = _deploymentFee;
    }

    function createPool(PoolConfig calldata config) 
        external 
        nonReentrant 
        returns (address poolAddress) 
    {
        require(bytes(config.name).length > 0, "Name required");
        require(config.maxMembers >= 5 && config.maxMembers <= 20, "Invalid max members");
        require(config.contributionAmount > 0, "Invalid contribution");
        require(config.cycleDuration >= 1 days, "Cycle too short");
        require(config.ujrahRate <= 500, "Ujrah too high");
        
        ArisanPool newPool = new ArisanPool(
            config.name,
            config.contributionAmount,
            config.maxMembers,
            config.cycleDuration,
            config.ujrahRate,
            IDRX_TOKEN,
            address(this)
        );
        
        poolAddress = address(newPool);
        
        poolMetadata[poolAddress] = PoolMetadata({
            poolAddress: poolAddress,
            creator: msg.sender,
            createdAt: block.timestamp,
            currentMembers: 0,
            status: PoolStatus.PENDING,
            totalValueLocked: 0
        });
        
        allPools.push(poolAddress);
        poolsByCreator[msg.sender].push(poolAddress);
        
        emit PoolCreated(
            poolAddress,
            msg.sender,
            config.name,
            config.maxMembers,
            config.contributionAmount
        );
        
        return poolAddress;
    }

    function updatePoolStatus(address poolAddress, PoolStatus newStatus) 
        external 
    {
        require(msg.sender == poolAddress, "Only pool can update");
        
        PoolStatus oldStatus = poolMetadata[poolAddress].status;
        poolMetadata[poolAddress].status = newStatus;
        
        emit PoolStatusUpdated(poolAddress, oldStatus, newStatus);
    }

    function registerMember(address poolAddress, address member) 
        external 
    {
        require(msg.sender == poolAddress, "Only pool can register");
        require(!isMemberOfPool[member][poolAddress], "Already member");
        
        isMemberOfPool[member][poolAddress] = true;
        poolMetadata[poolAddress].currentMembers++;
        
        emit MemberJoined(poolAddress, member, block.timestamp);
    }

    function getTotalPools() external view returns (uint256) {
        return allPools.length;
    }

    function getAllPools() external view returns (address[] memory) {
        return allPools;
    }

    function getPoolsByCreator(address creator) 
        external 
        view 
        returns (address[] memory) 
    {
        return poolsByCreator[creator];
    }

    function getPoolMetadata(address poolAddress) 
        external 
        view 
        returns (PoolMetadata memory) 
    {
        return poolMetadata[poolAddress];
    }

    function checkMembership(address user, address poolAddress) 
        external 
        view 
        returns (bool) 
    {
        return isMemberOfPool[user][poolAddress];
    }

    function setVestingManager(address _vestingManager) external onlyOwner {
        require(_vestingManager != address(0), "Invalid address");
        vestingManager = _vestingManager;
    }

    function setSocialVouching(address _socialVouching) external onlyOwner {
        require(_socialVouching != address(0), "Invalid address");
        socialVouching = _socialVouching;
    }

    function setDeploymentFee(uint256 _newFee) external onlyOwner {
        uint256 oldFee = deploymentFee;
        deploymentFee = _newFee;
        emit DeploymentFeeUpdated(oldFee, _newFee);
    }

    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid address");
        treasury = _treasury;
    }
}