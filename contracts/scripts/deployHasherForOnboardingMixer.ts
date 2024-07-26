import hre from "hardhat";
import dotenv from 'dotenv';
import fs from 'fs';
// @ts-ignore
import { createCode, abi} from 'circomlib/src/mimcsponge_gencontract.js';

async function main() {

  const envConfig = dotenv.parse(fs.readFileSync('.env'));

  let mimc;
  let bytecode = createCode("mimcsponge", 220);
  console.log(bytecode);
  console.log(abi);

  const signers = await hre.ethers.getSigners();
  const faucet = signers[2]; // deployer

  const C = new hre.ethers.ContractFactory(
      abi, // 3 input parameters: xL, xR, k
      bytecode,
      faucet
  );

  mimc = await C.deploy();
  await mimc.waitForDeployment();
  console.log(`Mimc deployed at: ${mimc.target}`);

  envConfig.HASHER_ONBOARDING = mimc.target.toString();

  const updatedEnv = Object.entries(envConfig).map(([key, value]) => `${key}=${value}`).join('\n');
  fs.writeFileSync('.env', updatedEnv);

}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });