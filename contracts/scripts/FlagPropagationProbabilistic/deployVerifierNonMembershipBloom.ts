import hre from "hardhat";
import fs from 'fs';
import dotenv from 'dotenv';

async function main() {

    const signers = await hre.ethers.getSigners();
    const faucet = signers[2];   

    const envConfig = dotenv.parse(fs.readFileSync('.env'));
    
    const verfierNonMembershipBloom = await hre.ethers.deployContract("VerifierNonMembershipBloom", [], faucet);
    await verfierNonMembershipBloom.waitForDeployment();
    console.log(`VerifierNonMembershipBloom: ${verfierNonMembershipBloom.target}`); 

    envConfig.VERIFIER_NON_MEMBERSHIP_BLOOM = verfierNonMembershipBloom.target.toString();

    const updatedEnv = Object.entries(envConfig).map(([key, value]) => `${key}=${value}`).join('\n');
    fs.writeFileSync('.env', updatedEnv);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});