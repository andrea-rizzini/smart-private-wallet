import hre from "hardhat";
import fs from 'fs';
import dotenv from 'dotenv';

async function main() {

    const signers = await hre.ethers.getSigners();
    const faucet = signers[2];   

    const envConfig = dotenv.parse(fs.readFileSync('.env'));
    
    const associationSet = await hre.ethers.deployContract("AssociationSet", [], faucet);
    await associationSet.waitForDeployment();
    console.log(`Association Set: ${associationSet.target}`); 

    envConfig.ASSOCIATION_SET = associationSet.target.toString();

    const updatedEnv = Object.entries(envConfig).map(([key, value]) => `${key}=${value}`).join('\n');
    fs.writeFileSync('.env', updatedEnv);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});