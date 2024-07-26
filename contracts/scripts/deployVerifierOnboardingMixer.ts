import hre from "hardhat";
import fs from 'fs';
import dotenv from 'dotenv';

async function main() {

    const signers = await hre.ethers.getSigners();
    const faucet = signers[2];   
    
    const verifier = await hre.ethers.deployContract("VerifierOnboarding", [], faucet);
    await verifier.waitForDeployment();
    console.log(`Verifier for onboarding deployed to ${verifier.target}`); 

    const envConfig = dotenv.parse(fs.readFileSync('.env'));
    envConfig.VERIFIER_ONBOARDING = verifier.target.toString();

    const updatedEnv = Object.entries(envConfig).map(([key, value]) => `${key}=${value}`).join('\n');
    fs.writeFileSync('.env', updatedEnv);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});