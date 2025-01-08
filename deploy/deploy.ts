import { deployContract } from "./utils";

export default async function () {
  const contractArtifactName = "ElysiumPaymaster";
  // const constructorArguments = ["Hi there!"];
  
  // await deployContract(contractArtifactName, constructorArguments);
  await deployContract(contractArtifactName);
}
