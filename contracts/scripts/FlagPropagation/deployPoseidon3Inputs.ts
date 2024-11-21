import hre from "hardhat";
import dotenv from 'dotenv';
import fs from 'fs';
// @ts-ignore
import { createCode, generateABI} from 'circomlib/src/poseidon_gencontract.js';

async function main() {

  const envConfig = dotenv.parse(fs.readFileSync('.env'));

  let poseidon;
  let bytecode = createCode(3); // npinputs
  let abi = generateABI(3); // npinputs

  console.log(abi)

  const signers = await hre.ethers.getSigners();
  const faucet = signers[2]; 

  const C = new hre.ethers.ContractFactory(
      abi, 
      bytecode,
      faucet
  );

  poseidon = await C.deploy();
  await poseidon.waitForDeployment();
  console.log(`Poseidon 3 inputs deployed at: ${poseidon.target}`);

  envConfig.HASHER_POSEIDON_3_INPUTS = poseidon.target.toString();

  const updatedEnv = Object.entries(envConfig).map(([key, value]) => `${key}=${value}`).join('\n');
  fs.writeFileSync('.env', updatedEnv);

}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });