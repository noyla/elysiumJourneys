import "@nomicfoundation/hardhat-chai-matchers";

import "@matterlabs/hardhat-zksync-ethers";
import { expect } from "chai";
import * as hre from "hardhat";
import { HardhatZksyncSigner } from "@matterlabs/hardhat-zksync-ethers";
import { Contract, Wallet } from "zksync-ethers";
import {
  getWallet,
  deployContract,
  LOCAL_RICH_WALLETS,
} from "../deploy/utils";


describe("BookingContract", function () {
  // let owner: any, user: any, provider: any, other: any;

  let ownerWallet: Wallet;
  let resourceId: string, userId: string, authorizedProviderCode: string;
  let bookingContract: Contract;

  beforeEach(async () => {
    // Get signers
    ownerWallet = getWallet(LOCAL_RICH_WALLETS[0].privateKey);

    // Booking data
    authorizedProviderCode = "F8WX5LZ"// "Lux Villas Paris"
    resourceId = "12345"
    userId = "3h389aomvnkl30eccvir3j"

    // Deploy the BookingContract
    bookingContract = await deployContract("BookingContract", [], {
      wallet: ownerWallet,
      silent: true,
    });

    // const BookingContractFactory = await hre.ethers.getContractFactory("BookingContract");
    // bookingContract = await BookingContractFactory.deploy(signerAddress);
    // await bookingContract.deployed();
    
    // Approve provider
    await bookingContract.approveProvider(authorizedProviderCode);
  });

  it("Should create a booking successfully", async () => {
    const bookingAmount = hre.ethers.parseEther("0.01");

    const additionalData = '{ "userAddress": "0x123456789" }';
    const encodedAdditionalData = hre.ethers.AbiCoder.defaultAbiCoder().encode(["string"], [additionalData]);
    const provider = await bookingContract.approvedProviders(authorizedProviderCode);
    console.log("###### providers: ", provider);
    
    await expect(
      await bookingContract.createBooking(userId, authorizedProviderCode, resourceId, 
        encodedAdditionalData, {
        value: bookingAmount,
        // gasLimit: 810000000,
      })).to.emit(bookingContract, "BookingCreated")
      .withArgs(1, userId, resourceId, bookingAmount, additionalData);

    const booking = await bookingContract.bookings(1);
    expect(booking.userId).to.equal(userId);
    expect(booking.providerCode).to.equal(authorizedProviderCode);
    expect(booking.amount).to.equal(bookingAmount);
    expect(booking.status).to.equal(0); // Pending
  });

  it("Should fail to create a booking with an unapproved provider", async () => {
    const unapprovedProvider = "ABCDEFG";
    const bookingAmount = hre.ethers.parseEther("0.01");

    const encodedAdditionalData = hre.ethers.AbiCoder.defaultAbiCoder().encode(["string"], [""]);
    await expect(
      await bookingContract.createBooking(userId, unapprovedProvider, resourceId, encodedAdditionalData, {
        value: bookingAmount,
      })
    ).to.be.revertedWith("Provider not approved");
  });

  // it("Should allow user to cancel a pending booking", async () => {
  //   const bookingAmount = hre.ethers.parseEther("0.01");

  //   // Create a booking
  //   await bookingContract.connect(signerAddress).createBooking(authorizedProviderCode, {
  //     value: bookingAmount,
  //   });

  //   // Cancel the booking
  //   await expect(bookingContract.connect(user).cancelBooking(1))
  //     .to.emit(bookingContract, "BookingCancelled")
  //     .withArgs(1, user.address);

  //   const booking = await bookingContract.bookings(1);
  //   expect(booking.status).to.equal(2); // Cancelled
  // });

  // it("Should fail to cancel a non-pending booking", async () => {
  //   const bookingAmount = hre.ethers.parseEther("1");

  //   // Create and confirm a booking
  //   await bookingContract.connect(user).createBooking(provider.address, {
  //     value: bookingAmount,
  //   });
  //   await bookingContract.connect(owner).confirmBooking(1);

  //   await expect(
  //     bookingContract.connect(user).cancelBooking(1)
  //   ).to.be.revertedWith("Cannot cancel this booking");
  // });

  // it("Should allow user or provider to dispute a booking", async () => {
  //   const bookingAmount = hre.ethers.parseEther("1");

  //   // Create and confirm a booking
  //   await bookingContract.connect(user).createBooking(provider.address, {
  //     value: bookingAmount,
  //   });
  //   await bookingContract.connect(owner).confirmBooking(1);

  //   // User disputes the booking
  //   await expect(bookingContract.connect(user).disputeBooking(1))
  //     .to.emit(bookingContract, "BookingDisputed")
  //     .withArgs(1, user.address, provider.address);

  //   const booking = await bookingContract.bookings(1);
  //   expect(booking.status).to.equal(3); // Disputed
  // });

  // it("Should allow owner to resolve a dispute", async () => {
  //   const bookingAmount = hre.ethers.parseEther("1");

  //   // Create and confirm a booking
  //   await bookingContract.connect(user).createBooking(provider.address, {
  //     value: bookingAmount,
  //   });
  //   await bookingContract.connect(owner).confirmBooking(1);

  //   // Dispute the booking
  //   await bookingContract.connect(user).disputeBooking(1);

  //   // Resolve the dispute in favor of the user
  //   await expect(bookingContract.connect(owner).resolveDispute(1, user.address))
  //     .to.emit(bookingContract, "BookingResolved")
  //     .withArgs(1, owner.address);

  //   const booking = await bookingContract.bookings(1);
  //   expect(booking.status).to.equal(4); // Resolved
  // });
});
