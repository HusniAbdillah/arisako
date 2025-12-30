// SPDX-License-Identifier:  MIT
pragma solidity ^0.8.24;

import "../interfaces/ISocialVouching.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SocialVouching
 * @notice System vouching untuk social collateral
 */
contract SocialVouching is ISocialVouching, Ownable {
    
    struct Vouch {
        address voucher;
        address vouchee;
        uint256 weight;
        uint256 timestamp;
        string message;
        bool isActive;
    }

    struct TrustScore {
        uint256 totalVouches;
        uint256 weightedScore;
        uint256 lastUpdated;
        bool isVerified;
    }

    mapping(address => TrustScore) public trustScores;
    mapping(address => mapping(address => Vouch)) public vouches;
    mapping(address => address[]) public vouchersOf;
    mapping(address => address[]) public voucheesOf;
    
    uint256 public constant MIN_VOUCH_WEIGHT = 1;
    uint256 public constant MAX_VOUCH_WEIGHT = 10;
    uint256 public constant VERIFICATION_THRESHOLD = 50;

    event VouchGiven(
        address indexed voucher,
        address indexed vouchee,
        uint256 weight,
        string message
    );
    
    event VouchRevoked(address indexed voucher, address indexed vouchee);
    
    event TrustScoreUpdated(address indexed user, uint256 newScore);
    
    event UserVerified(address indexed user);

    constructor() Ownable(msg.sender) {}

    function vouchFor(
        address _vouchee,
        uint256 _weight,
        string calldata _message
    ) external {
        require(_vouchee != address(0), "Invalid vouchee");
        require(_vouchee != msg.sender, "Cannot vouch self");
        require(_weight >= MIN_VOUCH_WEIGHT && _weight <= MAX_VOUCH_WEIGHT, "Invalid weight");
        require(!vouches[msg.sender][_vouchee].isActive, "Already vouched");
        
        vouches[msg.sender][_vouchee] = Vouch({
            voucher: msg.sender,
            vouchee: _vouchee,
            weight:  _weight,
            timestamp: block.timestamp,
            message: _message,
            isActive: true
        });
        
        vouchersOf[_vouchee].push(msg.sender);
        voucheesOf[msg.sender].push(_vouchee);
        
        _updateTrustScore(_vouchee);
        
        emit VouchGiven(msg.sender, _vouchee, _weight, _message);
    }
    
    function revokeVouch(address _vouchee) external {
        require(vouches[msg.sender][_vouchee].isActive, "No active vouch");
        
        vouches[msg.sender][_vouchee].isActive = false;
        
        _updateTrustScore(_vouchee);
        
        emit VouchRevoked(msg.sender, _vouchee);
    }

    function updateVouchWeight(address _vouchee, uint256 _newWeight) external {
        require(vouches[msg.sender][_vouchee].isActive, "No active vouch");
        require(_newWeight >= MIN_VOUCH_WEIGHT && _newWeight <= MAX_VOUCH_WEIGHT, "Invalid weight");
        
        vouches[msg.sender][_vouchee].weight = _newWeight;
        vouches[msg.sender][_vouchee].timestamp = block.timestamp;
        
        _updateTrustScore(_vouchee);
    }

    function _updateTrustScore(address _user) internal {
        address[] memory vouchers = vouchersOf[_user];
        uint256 totalWeight = 0;
        uint256 activeVouches = 0;
        
        for (uint256 i = 0; i < vouchers.length; i++) {
            Vouch memory vouch = vouches[vouchers[i]][_user];
            if (vouch.isActive) {
                totalWeight += vouch.weight;
                activeVouches++;
            }
        }
        
        trustScores[_user].totalVouches = activeVouches;
        trustScores[_user].weightedScore = totalWeight;
        trustScores[_user].lastUpdated = block.timestamp;
        
        if (totalWeight >= VERIFICATION_THRESHOLD && !trustScores[_user].isVerified) {
            trustScores[_user].isVerified = true;
            emit UserVerified(_user);
        }
        
        emit TrustScoreUpdated(_user, totalWeight);
    }

    function getTrustScore(address _user) external view returns (uint256) {
        return trustScores[_user].weightedScore;
    }
    
    function isVerified(address _user) external view returns (bool) {
        return trustScores[_user].isVerified;
    }
    
    function getVouchersOf(address _user) external view returns (address[] memory) {
        return vouchersOf[_user];
    }
    
    function getVoucheesOf(address _user) external view returns (address[] memory) {
        return voucheesOf[_user];
    }
    
    function getVouch(address _voucher, address _vouchee) 
        external 
        view 
        returns (Vouch memory) 
    {
        return vouches[_voucher][_vouchee];
    }
    
    function getTrustScoreDetails(address _user) 
        external 
        view 
        returns (TrustScore memory) 
    {
        return trustScores[_user];
    }
}