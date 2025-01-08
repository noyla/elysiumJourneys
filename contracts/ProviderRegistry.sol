// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "hardhat/console.sol";

contract ProviderRegistry is Ownable {
    mapping(string => bool) public approvedProviders;

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

    function normalizeString(string memory input) internal pure returns (string memory) {
        bytes memory temp = bytes(input);
        for (uint256 i = 0; i < temp.length; i++) {
            // Convert uppercase letters to lowercase (ASCII range)
            if (temp[i] >= 0x41 && temp[i] <= 0x5A) {
                temp[i] = bytes1(uint8(temp[i]) + 32);
            }
        }
        return string(temp);
    }
}
