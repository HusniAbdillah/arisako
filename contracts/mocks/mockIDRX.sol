// SPDX-License-Identifier:  MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockIDRX
 * @notice Mock IDRX token untuk testing
 */
contract MockIDRX is ERC20, Ownable {

    uint8 private _decimals;
    
    constructor() ERC20("Mock Rupiah Token", "mIDRX") Ownable(msg.sender) {
        _decimals = 6;
        _mint(msg.sender, 1000000000 * 10 ** _decimals);
    }
    
    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }
    
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
    
    function burn(address from, uint256 amount) external onlyOwner {
        _burn(from, amount);
    }

    function faucet(address to, uint256 amount) external {
        _mint(to, amount);
    }
}