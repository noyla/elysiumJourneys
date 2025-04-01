import { utils, Contract } from "zksync-ethers";
import { ethers } from "ethers";
import { DeployedContracts, deployedContracts } from "../contracts";
import dotenv from "dotenv";
import { adminWallet } from "../user";

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
        userId: string,
        authorizedProviderCode: string,
        resourceId: string,
        bookingAmount: number
    ): Promise<{ transactionHash: string }> {
        try {
            if (!userId || !authorizedProviderCode || !resourceId || !bookingAmount) {
                throw new Error("Missing required parameters.");
            }

            const amountInWei = ethers.parseEther(bookingAmount.toString());
            const encodedAdditionalData = ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [amountInWei]);
            
            const paymasterAddress = await this.paymasterContract.getAddress();
            const paymasterBalance = await adminWallet.provider.getBalance(paymasterAddress);
            console.log("###### Paymaster ETH Balance:", ethers.formatEther(paymasterBalance.toString()));

            if (parseFloat(ethers.formatEther(paymasterBalance.toString())) < bookingAmount) {
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
                userId,
                authorizedProviderCode,
                resourceId,
                encodedAdditionalData,
                {
                    customData: paymasterParams,
                }
            );

            console.log("###### Estimated gas", gasLimit);
            console.log("###### TEST #######");
            
            // Prepare the transaction data
            const txData = await this.bookingContract.createBooking.populateTransaction(
                userId,
                authorizedProviderCode,
                resourceId,
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

            // const tx = await bookingContract.createBooking(userId, authorizedProviderCode, resourceId, amountInWei, {
            //     customData: {
            //         paymasterParams: utils.getPaymasterParams(process.env.PAYMASTER_ADDRESS || "", {
            //             type: "General",
            //             innerInput: new Uint8Array(),
            //         }),
            //     },
            // });

            // await tx.wait();

            return { transactionHash: tx.hash };
        } catch (error) {
            console.error(error);
            if (error instanceof Error) {
                throw new Error(error.message);
            } else {
                throw new Error("Failed to create booking.");
            }
        }
    }
}