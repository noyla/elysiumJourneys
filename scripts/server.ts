import express, { Request, Response } from "express";
import { Provider, utils, Web3Provider} from "zksync-web3";
import { ethers } from "ethers";
import dotenv from "dotenv";
import { getWallet, LOCAL_RICH_WALLETS } from "../deploy/utils";
import { BookingManager } from "../server/booking/booking";

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());

// zkSync & Contract Configuration
const zkSyncProvider = new Provider(process.env.ZKSYNC_RPC_URL || "https://testnet.era.zksync.dev");
// const zkSyncProvider = new Web3Provider(new Provider(process.env.ZKSYNC_RPC_URL));
const wallet = getWallet(LOCAL_RICH_WALLETS[0].privateKey);
// const wallet = new Wallet(process.env.PRIVATE_KEY || "", zkSyncProvider);

const bookingContractAddress = process.env.BOOKING_CONTRACT_ADDRESS || "";
const bookingContractAbi = [
    "function createBooking(string userId, string authorizedProviderCode, string resourceId, uint256 bookingAmount) external payable"
];

const bookingContract = new ethers.Contract(bookingContractAddress, bookingContractAbi, wallet);
const bookingManager = new BookingManager()

/**
 * API Endpoint: Create a booking
 */
app.post("/api/bookings", async (req: Request, res: Response) => {
    try {
        const { userId, authorizedProviderCode, resourceId, bookingAmount } = req.body;

        const txHash = await bookingManager.createBooking(userId, authorizedProviderCode, resourceId, bookingAmount);
        if (!txHash) {
            console.error("Failed to create booking");
            res.status(500).json({ error: "Failed to create booking" });
        }
        // if (!userId || !authorizedProviderCode || !resourceId || !bookingAmount) {
        //     return res.status(400).json({ error: "Missing required fields" });
        // }

        // // Convert amount to Wei
        // const amountInWei = ethers.parseEther(bookingAmount.toString());

        // // Send transaction to zkSync
        // const tx = await bookingContract.createBooking(userId, authorizedProviderCode, resourceId, amountInWei, {
        //     customData: {
        //         paymasterParams: utils.getPaymasterParams(process.env.PAYMASTER_ADDRESS || "", {
        //             type: "General",
        //             innerInput: new Uint8Array(),
        //         }),
        //     },
        // });

        // await tx.wait();

        res.status(200).json({
            message: "Booking transaction submitted successfully",
            transactionHash: txHash,
        });

    } catch (error: any) {
        console.error("Booking error:", error);
        res.status(500).json({ error: "Failed to create booking", details: error.message });
    }
});

/**
 * API Health Check
 */
app.get("/", (req: Request, res: Response) => {
    res.send("Booking API is running...");
});

// Start Server
app.listen(port, () => {
    console.log(`🚀 Server running on http://localhost:${port}`);
});
