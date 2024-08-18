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

    await run(`verify:verify`, {
        address: poolUsers.target,
        constructorArguments: [],
    });

    const envConfig = dotenv.parse(fs.readFileSync('.env'));
    envConfig.POOL_USERS_ADDRESS = poolUsers.target.toString();

    const updatedEnv = Object.entries(envConfig).map(([key, value]) => `${key}=${value}`).join('\n');
    fs.writeFileSync('.env', updatedEnv);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});