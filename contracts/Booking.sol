// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@matterlabs/zksync-contracts/l2/system-contracts/interfaces/IPaymaster.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./ProviderRegistry.sol";

import "hardhat/console.sol";

contract BookingContract is ProviderRegistry {
    uint256 public disputeResolutionPeriod = 7 days;

    enum BookingStatus {
        Pending,
        Confirmed,
        Cancelled,
        Disputed,
        Resolved
    }

    struct Booking {
        bytes16 id;
        string userId;
        string providerCode;
        string resourceId;
        uint256 amount;
        BookingStatus status;
        bytes additionalData;
        uint256 createdAt;
        uint256 updatedAt;
    }

    // uint256 private bookingCounter = 0;
    mapping(bytes16 => Booking) public bookings;

    event BookingCreated(bytes16 indexed id, string indexed userId, 
                         string indexed resourceId, uint256 amount, bytes bookingData);
    event BookingCancelled(bytes16 indexed id, string indexed userId, address userAddress);
    event BookingDisputed(bytes16 indexed id, string indexed user, string indexed resourceId);
    event BookingResolved(bytes16 indexed id, address indexed resolver);

    // modifier onlyUser(uint256 bookingId) {
    //     require(bookings[bookingId].userId == msg.sender, "Not the user");
    //     _;
    // }

    constructor() ProviderRegistry() {
    }

    // Create a new booking
    function createBooking(string memory userId, string memory providerCode, 
                           string memory resourceId, bytes16 bookingId, bytes memory additionalData) 
        external payable onlyOwner() onlyApprovedProvider(providerCode) {
        
        // Used when user sends funds, web3 flow
        // require(msg.value > 0, "Amount must be greater than zero");

        (uint256 bookingAmount) = abi.decode(additionalData, (uint256));
        console.log("###### Booking amount: ", bookingAmount);

        bookings[bookingId] = Booking({
            id: bookingId,
            userId: userId,
            providerCode: providerCode,
            resourceId: resourceId,
            // amount: msg.value, // Used for web3 flow that users sends funds
            amount: bookingAmount,
            status: BookingStatus.Pending,
            additionalData: additionalData,
            createdAt: block.timestamp,
            updatedAt: block.timestamp
        });

        string memory bookingIdAsString = string(abi.encodePacked(bookingId));
        emit BookingCreated(bookingId, userId, resourceId, bookingAmount /*msg.value*/, additionalData);        
    }

    // Cancel a booking by user
    function cancelBooking(bytes16 bookingId) external {
        Booking storage booking = bookings[bookingId];
        require(booking.status == BookingStatus.Pending, "Cannot cancel this booking");

        booking.status = BookingStatus.Cancelled;
        booking.updatedAt = block.timestamp;

        // TODO: handle payment refund
        bool success = true;
        // payable(booking.user).transfer(booking.amount);
        // (bool success, ) = payable(booking.user).call{value: booking.amount}("");

        require(success, "Booking cancellation transfer failed");

        emit BookingCancelled(bookingId, booking.userId, address(0));
    }

    // Dispute a booking
    function disputeBooking(bytes16 bookingId) external {
        Booking storage booking = bookings[bookingId];
        // require(
        //     msg.sender == booking.userId /* || msg.sender == booking.provider*/,
        //     "Only user or provider can dispute"
        // );
        require(booking.status == BookingStatus.Confirmed, "Cannot dispute this booking");
        require(block.timestamp <= booking.createdAt + disputeResolutionPeriod, "Dispute period expired");

        booking.status = BookingStatus.Disputed;
        booking.updatedAt = block.timestamp;

        emit BookingDisputed(bookingId, booking.userId, booking.resourceId);
    }

    // Resolve a dispute (by owner or mediator)
    function resolveDispute(bytes16 bookingId, address winner) external onlyOwner {
        Booking storage booking = bookings[bookingId];
        require(booking.status == BookingStatus.Disputed, "No active dispute for this booking");

        booking.status = BookingStatus.Resolved;
        booking.updatedAt = block.timestamp;

        (bool success, ) = payable(winner).call{value: booking.amount}("");
        require(success, "Booking dispute transfer failed");

        emit BookingResolved(bookingId, msg.sender);
    }

    // Add funds for paymaster (gas sponsorship)
    function fundContract() external payable {
        require(msg.value > 0, "Amount must be greater than zero");
    }

    // Withdraw funds by owner
    function withdrawFunds() external onlyOwner {
        // payable(owner).transfer(address(this).balance);
        (bool success, ) = payable(owner()).call{value: address(this).balance}("");
        require(success, "Funds withdrawal failed");
    }
}
