// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import { IPaymaster, ExecutionResult } from "@matterlabs/zksync-contracts/l2/system-contracts/interfaces/IPaymaster.sol";
import { IPaymasterFlow } from "@matterlabs/zksync-contracts/l2/system-contracts/interfaces/IPaymasterFlow.sol";
import { Transaction, TransactionHelper } from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/TransactionHelper.sol";
import { BOOTLOADER_FORMAL_ADDRESS } from "@matterlabs/zksync-contracts/l2/system-contracts/Constants.sol";

import "@openzeppelin/contracts/access/Ownable.sol";

import "hardhat/console.sol";

interface IBookingContract {
    function isValidUserId(string memory userId) external view returns (bool);
}

contract ElysiumPaymaster is IPaymaster, Ownable {
    address bookingContractAddress;
    bytes4 constant PAYMASTER_VALIDATION_SUCCESS_MAGIC = 
        IPaymaster.validateAndPayForPaymasterTransaction.selector;
    
    event TransactionValidated(string indexed userId, uint256 requiredETH);
    event FundsWithdrawn(address _to, uint256 balance);
    
    constructor(address _bookingContractAddress) Ownable(msg.sender) {
        bookingContractAddress = _bookingContractAddress;
    }

    modifier onlyBootloader() {
        require(
            msg.sender == BOOTLOADER_FORMAL_ADDRESS,
            "Only bootloader can call this method"
        );
        // Continue execution if called from the bootloader.
        _;
    }

    function validateAndPayForPaymasterTransaction(
        bytes32,
        bytes32,
        Transaction calldata _transaction
    ) external payable onlyBootloader returns (bytes4 magic, bytes memory context) {
        // By default we consider the transaction as accepted.
        magic = PAYMASTER_VALIDATION_SUCCESS_MAGIC;
        require(
            _transaction.paymasterInput.length >= 4,
            "The standard paymaster input must be at least 4 bytes long"
        );

        bytes4 paymasterInputSelector = bytes4(
            _transaction.paymasterInput[0:4]
        );
        if (paymasterInputSelector == IPaymasterFlow.general.selector) {
            
            // Validations
            require(
                address(uint160(_transaction.to)) == bookingContractAddress,
                "Paymaster can only be used for the Booking Contract"
            );

            // Check if `userId` is valid
            string memory userId = abi.decode(_transaction.data[4:], (string));
            IBookingContract bookingContract = IBookingContract(bookingContractAddress);
            require(bookingContract.isValidUserId(userId), "Invalid or unknown userId");

            // Extract transaction function call
            bytes4 functionSelector = bytes4(_transaction.data[0:4]);
            
            // Expected selector for createBooking
            bytes4 expectedSelector = bytes4(keccak256("createBooking(string,string,string,bytes)"));
            require(functionSelector == expectedSelector, "Function not approved by Paymaster");

            
            // The minimal amount of ETH needed is tx.gasPrice * tx.gasLimit,
            // neither paymaster nor account are allowed to access this context variable.
            uint256 requiredETH = _transaction.gasLimit *
                _transaction.maxFeePerGas;
            
            bool success = TransactionHelper.payToTheBootloader(_transaction);
            require(
                success,
                "Failed to transfer tx fee to the Bootloader. Paymaster balance might not be enough."
            );
            
            console.log("Transaction validated for userId: ", userId);
            emit TransactionValidated(userId, requiredETH);
        } else {
            revert("Unsupported paymaster flow in paymasterParams.");
        }
    }

    function postTransaction(
        bytes calldata _context,
        Transaction calldata _transaction,
        bytes32,
        bytes32,
        ExecutionResult _txResult,
        uint256 _maxRefundedGas
    ) external payable override onlyBootloader {}

    function withdraw(address payable _to) external onlyOwner {
        uint256 balance = address(this).balance;
        (bool success, ) = _to.call{value: balance}("");
        require(success, "Failed to withdraw funds from paymaster.");
        emit FundsWithdrawn(_to, balance);
    }

    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    receive() external payable {}
}