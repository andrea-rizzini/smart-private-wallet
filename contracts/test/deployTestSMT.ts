import dotenv from 'dotenv';
import fs from 'fs';
import hre from 'hardhat';
import { run } from "hardhat";

async function main () {
    
    const envConfig = dotenv.parse(fs.readFileSync('.env'));
    const HASHER_TRANSFERS = process.env.HASHER_TRANSFERS || '';
    const HASHER_POSEIDON_3_INPUTS = process.env.HASHER_POSEIDON_3_INPUTS || '';

    const signers = await hre.ethers.getSigners();
    const faucet = signers[2];  

    const contract = await hre.ethers.getContractFactory("TestSMT", faucet);

    const contract_ = await contract.deploy(HASHER_TRANSFERS, HASHER_POSEIDON_3_INPUTS);
    await contract_.waitForDeployment();

    console.log(`TestSMT deployed at: ${contract_.target}`);

    // verify the contract
    // await run("verify:verify", {
    //     address: contract_.target,
    //     constructorArguments: [HASHER_TRANSFERS, HASHER_POSEIDON_3_INPUTS]
    // });

    // write new addresses to .env file
    envConfig.TEST_SMT = contract_.target.toString();
    const updatedEnv = Object.entries(envConfig).map(([key, value]) => `${key}=${value}`).join('\n');
    fs.writeFileSync('.env', updatedEnv);

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })