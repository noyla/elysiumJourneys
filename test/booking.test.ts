import "@nomicfoundation/hardhat-chai-matchers";

import "@matterlabs/hardhat-zksync-ethers";
import { expect } from "chai";
import * as hre from "hardhat";
import { Contract, utils, Wallet } from "zksync-ethers";
import {
  getWallet,
  deployContract,
  LOCAL_RICH_WALLETS,
} from "../deploy/utils";
import { BookingManager } from "../server/booking/booking";
import { assert } from "console";
import { initializeAdminWallet } from "../server/user";
import { DeployedContracts, setDeployedContract } from "../server/contracts";


describe("BookingContract", function () {
  // let owner: any, user: any, provider: any, other: any;

  let ownerWallet: Wallet;
  let resourceId: string, userId: string, authorizedProviderCode: string;
  let bookingContract: Contract;
  let bookingContractAddress: string;
  let paymasterContractAddress: string;

  let bookingManager: BookingManager;

  beforeEach(async () => {
    // Initialize the BookingManager
    bookingManager = new BookingManager();
    
    // Get signers    
    ownerWallet = getWallet(LOCAL_RICH_WALLETS[1].privateKey);

    // Booking data
    authorizedProviderCode = "F8WX5LZ"// "Lux Villas Paris"
    resourceId = "12345"
    userId = "3h389aomvnkl30eccvir3j"

    // Deploy the BookingContract
    bookingContract = await deployContract("BookingContract", [], {
      wallet: ownerWallet,
      silent: true,
    });

    // Deploy the Paymaster
    bookingContractAddress = await bookingContract.getAddress();
    const paymasterContract = await deployContract("ElysiumPaymaster", 
      [bookingContractAddress], {
        wallet: ownerWallet,
        silent: true,
      }
    );

    await setDeployedContract(DeployedContracts.Booking, bookingContract);
    await setDeployedContract(DeployedContracts.Paymaster, paymasterContract);

    await initializeAdminWallet(LOCAL_RICH_WALLETS[1].privateKey);

    paymasterContractAddress = await paymasterContract.getAddress();
    console.log("####### Paymaster deployed at:", paymasterContractAddress);

    // Authorize the userId
    await bookingContract.addUserId(userId);
    
    // Approve provider
    await bookingContract.approveProvider(authorizedProviderCode);

    // Send some ETH to the Paymaster
    const depositTx = await ownerWallet.sendTransaction({
      to: paymasterContractAddress,
      value: hre.ethers.parseEther("0.01"), // Deposit 0.01 ETH
    });
    await depositTx.wait();
    console.log("Deposited ETH in paymaster. Hash:", depositTx.hash);
    
    // const BookingContractFactory = await hre.ethers.getContractFactory("BookingContract");
    // bookingContract = await BookingContractFactory.deploy(signerAddress);
    // await bookingContract.deployed();
  });

  it("Should create a booking successfully with Paymaster", async () => {
    const bookingAmount = hre.ethers.parseEther("0.01");

    // const additionalData = '{ "amount": 10 }';

    const encodedAdditionalData = hre.ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [bookingAmount]);
    const provider = await bookingContract.approvedProviders(authorizedProviderCode);
    console.log("###### providers: ", provider);

    // Create booking without Paymaster
    // const tx = await bookingContract.createBooking(userId, authorizedProviderCode, resourceId, 
    //   encodedAdditionalData, {
    //   value: bookingAmount,
    //   // gasLimit: 810000000,
    // });

    // Check balance of the Paymaster
    const paymasterBalance = await ownerWallet.provider.getBalance(paymasterContractAddress);
    console.log("###### Paymaster ETH Balance:", hre.ethers.formatEther(paymasterBalance));

    if (paymasterBalance < bookingAmount) {
      console.log("###### Paymaster ETH Balance is less than booking amount. Reverting transaction.");
      assert(false, "Paymaster ETH Balance is less than booking amount. Reverting transaction.");
      // Send some ETH to the Paymaster
      // const depositTx = await ownerWallet.sendTransaction({
      //   to: paymasterContractAddress,
      //   value: bookingAmount,
      // });

      // console.log("Deposited ETH in paymaster", depositTx.hash);
      // await depositTx.wait();
    }

    const paymasterParams = {
      paymasterParams: utils.getPaymasterParams(paymasterContractAddress, {
        innerInput: new Uint8Array(),
        type: "General",
      }),
    }
    
    // Estimate gas for the transaction
    const gasLimit = await bookingContract.createBooking.estimateGas(
      userId,
      authorizedProviderCode,
      resourceId,
      encodedAdditionalData,
      {
          customData: paymasterParams,
      }
    );

    console.log("###### Estimated gas", gasLimit);

    // Prepare the transaction data
    const txData = await bookingContract.createBooking.populateTransaction(
      userId,
      authorizedProviderCode,
      resourceId,
      encodedAdditionalData
    );

    // console.log("###### txData: ", txData);
    
    // Send the transaction with Paymaster
    const tx = await ownerWallet.sendTransaction({
        ...txData,
        to: await bookingContract.getAddress(),
        data: txData.data,
        gasLimit,
        customData: paymasterParams,
    });

    // Expect the event to be emitted and booking to be created with the correct values.
    await expect(
        tx
    ).to.emit(bookingContract, "BookingCreated")
    .withArgs(1, userId, resourceId, bookingAmount, encodedAdditionalData);

    const booking = await bookingContract.bookings(1);
    expect(booking.userId).to.equal(userId);
    expect(booking.providerCode).to.equal(authorizedProviderCode);
    expect(booking.amount).to.equal(bookingAmount);
    expect(booking.status).to.equal(0); // Pending
  });

  // it("Should create a booking via the bookingManager API", async () => {
  //   // const bookingAmount = hre.ethers.parseEther("0.01");
  //   const bookingAmount = parseFloat("0.01");

  //   console.log("###### Creating booking...");
  //   const txHash = await bookingManager.createBooking(userId, authorizedProviderCode, resourceId, bookingAmount);
  //   console.log("###### txHash: ", txHash);

  //   // Assertions
  //   expect(txHash).to.not.be.null;
    
  //   const booking = await bookingContract.bookings(1);
  //   expect(booking.userId).to.equal(userId);
  //   expect(booking.providerCode).to.equal(authorizedProviderCode);
  //   expect(booking.amount).to.equal(bookingAmount);
  //   expect(booking.status).to.equal(0); // Pending

  // });

  it("Should fail to create a booking with an unauthorized userId", async () => {
  });

  it("Should fail to create a booking with an unapproved provider", async () => {
    const unapprovedProvider = "ABCDEFG";
    const bookingAmount = hre.ethers.parseEther("0.01");

    const encodedAdditionalData = hre.ethers.AbiCoder.defaultAbiCoder().encode(["string"], [""]);
    await expect(
      bookingContract.createBooking(userId, unapprovedProvider, resourceId, encodedAdditionalData, {
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
