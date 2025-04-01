import { Contract } from "zksync-ethers";


export enum DeployedContracts {
    Booking = 1,
    Paymaster,
  }

export const deployedContracts: { [key: string]: Contract } = {};

export async function setDeployedContract(contractType: DeployedContracts, contract: Contract) {
    // return new ethers.Contract(bookingContractAddress, bookingContractAbi, wallet);
    deployedContracts[contractType] = contract;
}