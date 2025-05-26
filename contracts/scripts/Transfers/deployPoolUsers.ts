import hre from "hardhat";
import fs from 'fs';
import dotenv from 'dotenv';
import { run } from "hardhat";

async function main() {

    const signers = await hre.ethers.getSigners();
    const faucet = signers[2];   
    
    const poolUsers = await hre.ethers.deployContract("PoolUsers", [], faucet);
    await poolUsers.waitForDeployment();
    console.log(`poolUsers deployed to ${poolUsers.target}`); 

    const receipt = await poolUsers.deploymentTransaction()?.wait();
    const deployBlock = receipt?.blockNumber;
    console.log(`PoolUsers deployed at block: ${deployBlock}`);

    try {
        await run("verify:verify", {
            address: poolUsers.target,
            constructorArguments: [],
        });
    } catch (err: any) {
        console.error(`Already verified`);
    }

    const envConfig = dotenv.parse(fs.readFileSync('.env'));
    envConfig.POOL_USERS_ADDRESS = poolUsers.target.toString();
    if (deployBlock) {
        envConfig.POOL_USERS_DEPLOY_BLOCK = deployBlock.toString();
    }

    const updatedEnv = Object.entries(envConfig).map(([key, value]) => `${key}=${value}`).join('\n');
    fs.writeFileSync('.env', updatedEnv);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});