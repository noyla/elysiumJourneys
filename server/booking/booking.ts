import { utils, Contract } from "zksync-ethers";
import { ethers } from "ethers";
import { DeployedContracts, deployedContracts } from "../contracts";
import { BookingRecord } from "./bookingRecord";
import dotenv from "dotenv";
import { adminWallet } from "../user";
import { v4 as uuidv4 } from 'uuid';


dotenv.config();


export class BookingManager {
    private bookingContract: Contract;
    private paymasterContract: Contract;
    
    constructor() {
        // this.bookingContract = new ethers.Contract(bookingContractAddress, bookingContractAbi, wallet);
        this.bookingContract = deployedContracts[DeployedContracts.Booking];
        this.paymasterContract = deployedContracts[DeployedContracts.Paymaster];
    }

    /**
     * Function to create a booking transaction on zkSync
     */
    public async createBooking(
        bookingRecord: BookingRecord,
    ): Promise<BookingRecord> {
        try {
            if (!bookingRecord.userId || !bookingRecord.authorizedProviderCode || 
                !bookingRecord.resourceId || !bookingRecord.bookingAmount) {
                throw new Error("Missing required parameters.");
            }

            const bookingId = "0x" + uuidv4().replace(/-/g, "");
            console.log("%%%%%%%% Booking ID:", bookingId);
            console.log("%%%%%%%% Booking amount:", bookingRecord.bookingAmount);
            // const amountInWei = bookingRecord.bookingAmount.toString();
            const encodedAdditionalData = ethers.AbiCoder.defaultAbiCoder().encode(
                ["uint256"], 
                [bookingRecord.bookingAmount]);
            
            const paymasterAddress = await this.paymasterContract.getAddress();
            const paymasterBalance = await adminWallet.provider.getBalance(paymasterAddress);
            console.log("###### Paymaster ETH Balance:", ethers.formatEther(paymasterBalance.toString()));

            if (parseFloat(ethers.formatEther(paymasterBalance.toString())) < bookingRecord.bookingAmount) {
                console.log("###### Paymaster ETH Balance is less than booking amount. Reverting transaction.");
            }

            const paymasterParams = {
                paymasterParams: utils.getPaymasterParams(paymasterAddress, {
                    innerInput: new Uint8Array(),
                    type: "General",
                }),
            }

            // Estimate gas for the transaction
            const gasLimit = await this.bookingContract.createBooking.estimateGas(
                bookingRecord.userId,
                bookingRecord.authorizedProviderCode,
                bookingRecord.resourceId,
                bookingId,
                encodedAdditionalData,
                {
                    customData: paymasterParams,
                }
            );
            
            // Prepare the transaction data
            const txData = await this.bookingContract.createBooking.populateTransaction(
                bookingRecord.userId,
                bookingRecord.authorizedProviderCode,
                bookingRecord.resourceId,
                bookingId,
                encodedAdditionalData
            );

            const bookingContractAddress = await this.bookingContract.getAddress();
            const tx = await adminWallet.sendTransaction({
                ...txData,
                to: bookingContractAddress,
                data: txData.data,
                gasLimit,
                customData: paymasterParams,
            });

            bookingRecord.transactionHash = tx.hash;
            bookingRecord.bookingId = bookingId;
            return bookingRecord;
        } catch (error) {
            console.error(error);
            if (error instanceof Error) {
                throw new Error(error.message);
            } else {
                throw new Error("Failed to create booking.");
            }
        }
    }

    public async getBooking(bookingId: string): Promise<BookingRecord> {
        console.log("###### Booking ID:", bookingId);
        const booking = await this.bookingContract.bookings.staticCall(bookingId);
        console.log("@@@@@@@@ booking: ", booking);
        const bookingRecord = new BookingRecord();
        bookingRecord.userId = booking.userId;
        bookingRecord.bookingId = booking.id;
        bookingRecord.status = booking.status;
        bookingRecord.authorizedProviderCode = booking.providerCode;
        bookingRecord.resourceId = booking.resourceId;
        bookingRecord.bookingAmount = booking.amount;
        bookingRecord.transactionHash = booking.transactionHash;
        return bookingRecord;
    }
}