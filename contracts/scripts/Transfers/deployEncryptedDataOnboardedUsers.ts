import hre from "hardhat";
import fs from 'fs';
import dotenv from 'dotenv';

async function main() {

    const signers = await hre.ethers.getSigners();
    const faucet = signers[2];   
    
    const encryptedData = await hre.ethers.deployContract("EncryptedDataOnboardedUsers", [], faucet);
    await encryptedData.waitForDeployment();
    console.log(`EncryptedDataOnboardedUsers deployed to ${encryptedData.target}`); 

    const envConfig = dotenv.parse(fs.readFileSync('.env'));
    envConfig.ENCRYPTED_DATA_ADDRESS = encryptedData.target.toString();

    const updatedEnv = Object.entries(envConfig).map(([key, value]) => `${key}=${value}`).join('\n');
    fs.writeFileSync('.env', updatedEnv);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});