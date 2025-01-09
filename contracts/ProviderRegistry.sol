// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "hardhat/console.sol";

contract ProviderRegistry is Ownable {
    mapping(string => bool) public approvedProviders;
    mapping(string => bool) public approvedUserIds;

    event ProviderApproved(string providerCode, bool approved);

    modifier onlyApprovedProvider(string memory providerCode) {
        require(approvedProviders[providerCode] == true, "Provider not approved");
        _;
    }

    constructor() Ownable(msg.sender) {
    }

    // Approve a provider (only callable by the owner)
    function approveProvider(string memory providerCode) external onlyOwner {
        approvedProviders[providerCode] = true;
        console.log("Provider approved:", providerCode, approvedProviders[providerCode]); 
        emit ProviderApproved(providerCode, approvedProviders[providerCode]);
    }

    // Remove a provider
    function removeProvider(string memory providerCode) external onlyOwner {
        approvedProviders[providerCode] = false;
    }

    function addUserId(string memory userId) external onlyOwner {
        approvedUserIds[userId] = true;
    }

    function removeUserId(string memory userId) external onlyOwner {
        approvedUserIds[userId] = false;
    }
    
    function isValidUserId(string memory userId) external view returns (bool) {
        return approvedUserIds[userId];
    }
}
