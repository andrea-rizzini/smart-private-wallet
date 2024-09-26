import hre from "hardhat";
import fs from 'fs';
import dotenv from 'dotenv';

async function main() {

    const signers = await hre.ethers.getSigners();
    const faucet = signers[2];   

    const envConfig = dotenv.parse(fs.readFileSync('.env'));
    
    const verifierPOI2 = await hre.ethers.deployContract("VerifierPOI2", [], faucet);
    await verifierPOI2.waitForDeployment();
    console.log(`VerifierPOI: ${verifierPOI2.target}`); 

    envConfig.VERIFIER_POI_2 = verifierPOI2.target.toString();

    const verifierPOI16 = await hre.ethers.deployContract("VerifierPOI16", [], faucet);
    await verifierPOI16.waitForDeployment();
    console.log(`VerifierPOI16: ${verifierPOI16.target}`);

    envConfig.VERIFIER_POI_16 = verifierPOI16.target.toString();

    const updatedEnv = Object.entries(envConfig).map(([key, value]) => `${key}=${value}`).join('\n');
    fs.writeFileSync('.env', updatedEnv);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});