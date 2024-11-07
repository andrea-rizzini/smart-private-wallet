import dotenv from 'dotenv';
import fs from 'fs';
import hre from "hardhat";

const EP_ADDRESS: string = process.env.ENTRY_POINT_ADDRESS || '';
const PM_ADDRESS: string = process.env.PAYMASTER_ADDRESS || '';

async function main() {

    const signers = await hre.ethers.getSigners();
    const faucet = signers[2];

    const ep = await hre.ethers.getContractAt("EntryPoint", EP_ADDRESS, faucet);

    const amountInWei = await ep.balanceOf(PM_ADDRESS);
    console.log("\nPM balance in Wei:",
        amountInWei
    );
    console.log("\nPM balance in Gwei: ", Number(amountInWei) / Number(BigInt("1000000000")));
    const amountInEther = Number(amountInWei) / Number(BigInt("1000000000000000000"));
    const amountInEtherWithDecimals = amountInEther.toFixed(18);
    console.log("PM balance in Eth:",
        amountInEtherWithDecimals
    );

}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });