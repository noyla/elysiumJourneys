import "@nomicfoundation/hardhat-chai-matchers";

import "@matterlabs/hardhat-zksync-ethers";
import { v4 as uuidv4 } from 'uuid';
import { expect } from "chai";
import * as hre from "hardhat";
import { Contract, utils, Wallet } from "zksync-ethers";
import {
  getWallet,
  deployContract,
  LOCAL_RICH_WALLETS,
} from "../deploy/utils";
import { BookingManager } from "../server/booking/booking";
import { BookingRecord, BookingStatus } from "../server/booking/bookingRecord";
import { assert } from "console";
import { initializeAdminWallet } from "../server/user";
import { DeployedContracts, setDeployedContract } from "../server/contracts";


describe("Booking Flow", function () {
  // let owner: any, user: any, provider: any, other: any;
  
  let ownerWallet: Wallet;
  let resourceId: string, userId: string, authorizedProviderCode: string;
  let bookingContract: Contract;
  let bookingContractAddress: string;
  let paymasterContractAddress: string;
  
  let bookingManager: BookingManager;
  const bookingRecord = new BookingRecord();
  
  beforeEach(async () => {  
    // Get signers    
    ownerWallet = getWallet(LOCAL_RICH_WALLETS[1].privateKey);
    
    // Booking data
    bookingRecord.authorizedProviderCode = "F8WX5LZ"// "Lux Villas Paris"
    bookingRecord.resourceId = "12345"
    bookingRecord.userId = "3h389aomvnkl30eccvir3j"
    bookingRecord.bookingId = "0x" + uuidv4().replace(/-/g, "");
    
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
    await bookingContract.addUserId(bookingRecord.userId);
    
    // Approve provider
    await bookingContract.approveProvider(bookingRecord.authorizedProviderCode);
    
    // Send some ETH to the Paymaster
    const depositTx = await ownerWallet.sendTransaction({
      to: paymasterContractAddress,
      value: hre.ethers.parseEther("0.01"), // Deposit 0.01 ETH
    });
    await depositTx.wait();
    console.log("Deposited ETH in paymaster. Hash:", depositTx.hash);
    
    // Initialize the BookingManager
    bookingManager = new BookingManager();

    // const BookingContractFactory = await hre.ethers.getContractFactory("BookingContract");
    // bookingContract = await BookingContractFactory.deploy(signerAddress);
    // await bookingContract.deployed();
  });
  
  describe("Booking Contract", function () {
    it("Should create a booking with Paymaster", async () => {
      const bookingAmount = hre.ethers.parseEther("0.01");
      const encodedAdditionalData = hre.ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [bookingAmount]);
      const provider = await bookingContract.approvedProviders(bookingRecord.authorizedProviderCode);

      // Check balance of the Paymaster
      const paymasterBalance = await ownerWallet.provider.getBalance(paymasterContractAddress);
      console.log("###### Paymaster ETH Balance:", hre.ethers.formatEther(paymasterBalance));

      if (paymasterBalance < bookingAmount) {
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
        bookingRecord.userId,
        bookingRecord.authorizedProviderCode,
        bookingRecord.resourceId,
        bookingRecord.bookingId,
        encodedAdditionalData,
        {
            customData: paymasterParams,
        }
      );

      console.log("###### Estimated gas", gasLimit);

      // Prepare the transaction data
      const txData = await bookingContract.createBooking.populateTransaction(
        bookingRecord.userId,
        bookingRecord.authorizedProviderCode,
        bookingRecord.resourceId,
        bookingRecord.bookingId,
        encodedAdditionalData
      );
      
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
      .withArgs(bookingRecord.bookingId, bookingRecord.userId, bookingRecord.resourceId, bookingAmount, encodedAdditionalData);
      console.log("###### BookingId: ", bookingRecord.bookingId);
      const booking = await bookingContract.bookings(bookingRecord.bookingId);
      expect(booking.userId).to.equal(bookingRecord.userId);
      expect(booking.providerCode).to.equal(bookingRecord.authorizedProviderCode);
      expect(booking.amount).to.equal(bookingAmount);
      expect(booking.status).to.equal(0); // Pending
    });

    it("Should fail to create a booking with an unauthorized userId", async () => {
    });

    it("Should fail to create a booking with an unapproved provider", async () => {
      const unapprovedProvider = "ABCDEFG";
      const bookingAmount = hre.ethers.parseEther("0.01");

      const encodedAdditionalData = hre.ethers.AbiCoder.defaultAbiCoder().encode(["string"], [""]);
      await expect(
        bookingContract.createBooking(
          bookingRecord.userId, 
          unapprovedProvider, 
          bookingRecord.resourceId,
          bookingRecord.bookingId, 
          encodedAdditionalData, {
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

  describe("Booking Manager", function () {
    it('Should create a booking successfully', async () => {
      // Booking data
      bookingRecord.bookingAmount = hre.ethers.parseEther("0.01");
      console.log("###### Booking: ", bookingRecord);
      const booking = await bookingManager.createBooking(bookingRecord);
      
      // Assertions
      expect(booking).to.not.be.null;
  
      // Expect the event to be emitted and booking to be created with the correct values.
      const b = await bookingManager.getBooking(booking.bookingId!)
      console.log("fSfsjdfdsjfklds booking: ",b);
      expect(b.bookingId).to.exist;
      expect(b.userId).to.equal(bookingRecord.userId);
      expect(b.authorizedProviderCode).to.equal(bookingRecord.authorizedProviderCode);
      expect(b.bookingAmount).to.equal(bookingRecord.bookingAmount);
      expect(b.status).to.equal(BookingStatus.Pending); // Pending
    });
  });
});
