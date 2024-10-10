import dotenv from 'dotenv';
import fs from 'fs'
import hre from "hardhat";
import { run } from "hardhat";

async function main() {

    const envConfig = dotenv.parse(fs.readFileSync('.env'));

    const HASHER_TRANSFERS = process.env.HASHER_TRANSFERS || '';
    const USDC_ADDRESS: string = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'
    const VERIFIER_2 = process.env.VERIFIER_2 || '';
    const VERIFIER_16 = process.env.VERIFIER_16 || '';
    const VERIFIER_POI_2 = process.env.VERIFIER_POI_2 || '';
    const VERIFIER_POI_16 = process.env.VERIFIER_POI_16 || '';
    const ASSOCIATION_SET = process.env.ASSOCIATION_SET || '';

    const signers = await hre.ethers.getSigners();
    const faucet = signers[2];  

    const utxosPool = await hre.ethers.getContractFactory("UTXOsPoolWithCompliance", faucet);
    const utxosPool_ = await utxosPool.deploy(VERIFIER_2, VERIFIER_16, VERIFIER_POI_2, VERIFIER_POI_16, USDC_ADDRESS, 20, HASHER_TRANSFERS); 
    await utxosPool_.waitForDeployment();
    console.log(`UTXOsPool deployed to ${utxosPool_.target}`);

    envConfig.UTXOS_POOL_ADDRESS_WITH_COMPLIANCE = utxosPool_.target.toString();

    // await run(`verify:verify`, {
    //     address: utxosPool_.target,
    //     constructorArguments: [VERIFIER_2, VERIFIER_16, VERIFIER_POI_2, VERIFIER_POI_16, ASSOCIATION_SET, USDC_ADDRESS, 20, HASHER_TRANSFERS],
    // }); 

    const updatedEnv = Object.entries(envConfig).map(([key, value]) => `${key}=${value}`).join('\n');
    fs.writeFileSync('.env', updatedEnv);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })