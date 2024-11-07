import hre from "hardhat";
import fs from 'fs';
import dotenv from 'dotenv';

async function main() {

    const signers = await hre.ethers.getSigners();
    const faucet = signers[2];   

    const envConfig = dotenv.parse(fs.readFileSync('.env'));
    
    const verifierMaskedCommitment = await hre.ethers.deployContract("VerifierMaskCommitment", [], faucet);
    await verifierMaskedCommitment.waitForDeployment();
    console.log(`VerifierMaskedCommitment: ${verifierMaskedCommitment.target}`); 

    envConfig.VERIFIER_MASKED_COMMITMENT = verifierMaskedCommitment.target.toString();

    const updatedEnv = Object.entries(envConfig).map(([key, value]) => `${key}=${value}`).join('\n');
    fs.writeFileSync('.env', updatedEnv);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});