import hre from "hardhat";
import dotenv from 'dotenv';

const EP_ADDRESS: string = process.env.ENTRY_POINT_ADDRESS || '';
const PM_ADDRESS: string = process.env.PAYMASTER_ADDRESS || '';

async function main() {

    if (!EP_ADDRESS || !PM_ADDRESS) {
        throw new Error("Environment variables ENTRY_POINT_ADDRESS and PAYMASTER_ADDRESS must be defined");
    }

    const signers = await hre.ethers.getSigners();
    const faucet = signers[2];

    const ep = await hre.ethers.getContractAt("EntryPoint", EP_ADDRESS, faucet);
    await ep.depositTo(PM_ADDRESS, { 
        value: hre.ethers.parseEther(".07"), // this is gonna take base-sep eth from our metamask wallet and deposit it into the paymaster
    }); 
    console.log("PM funded successfully"); // tofix

    const amountInWei = await ep.balanceOf(PM_ADDRESS);
    console.log("\nPM balance in Wei:",
        amountInWei
    );
    const amountInEther = Number(amountInWei) / Number(BigInt("1000000000000000000"));
    const amountInEtherWithDecimals = amountInEther.toFixed(18);
    console.log("PM balance in Eth:",
        amountInEtherWithDecimals
    );

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })