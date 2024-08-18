import hre from "hardhat";
import fs from 'fs';
import dotenv from 'dotenv';

async function main() {

    const signers = await hre.ethers.getSigners();
    const faucet = signers[2];   

    const envConfig = dotenv.parse(fs.readFileSync('.env'));
    
    const verifier2 = await hre.ethers.deployContract("Verifier2", [], faucet);
    await verifier2.waitForDeployment();
    console.log(`Verifier2: ${verifier2.target}`); 

    envConfig.VERIFIER_2 = verifier2.target.toString();

    const verifier16 = await hre.ethers.deployContract("Verifier16", [], faucet);
    await verifier16.waitForDeployment();
    console.log(`Verifier16: ${verifier16.target}`); 

    envConfig.VERIFIER_16 = verifier16.target.toString();

    const updatedEnv = Object.entries(envConfig).map(([key, value]) => `${key}=${value}`).join('\n');
    fs.writeFileSync('.env', updatedEnv);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});