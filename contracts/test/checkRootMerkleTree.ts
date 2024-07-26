import { BigNumberish } from "circomlibjs";
import hre from "hardhat";
require("dotenv").config();

async function main() {
    const tree = await hre.ethers.getContractAt("OnboardingMixer", "0xeE4d9eA3e9Aa563E19d59f523D2306cdA9A0bf02");
    const index: BigNumberish = 9; // Replace with the appropriate index
    const roots = await tree.roots(index); 
    console.log(roots);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })