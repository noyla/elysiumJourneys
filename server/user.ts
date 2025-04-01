import { Wallet } from "zksync-ethers";
import { getWallet } from "../deploy/utils";

export type User = {
    id: string;
    name: string;
    email: string;
    walletAddress?: string;
}

export let adminWallet: Wallet;

export async function initializeAdminWallet(privateKey: string) {
    adminWallet = getWallet(privateKey);
}
