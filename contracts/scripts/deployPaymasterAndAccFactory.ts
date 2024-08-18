import dotenv from 'dotenv';
import fs from 'fs';
import hre from "hardhat";
import path from 'path';
import { clearJsonFile } from '../../apps/version1_onboarding/src/utils/clearJsonFile';

const EP_ADDRESS: string = process.env.ENTRY_POINT_ADDRESS || '';

async function main() {

  const envConfig = dotenv.parse(fs.readFileSync('.env'));

  const signers = await hre.ethers.getSigners();
  const faucet = signers[2];

  // deploy paymaster
  const pm = await hre.ethers.deployContract("Paymaster", [], { signer: faucet });
  await pm.waitForDeployment();
  console.log(`PM: ${pm.target}`); 
  envConfig.PAYMASTER_ADDRESS = pm.target.toString();
  
  const ep = await hre.ethers.getContractAt("EntryPoint", EP_ADDRESS, faucet);
  await ep.depositTo(pm.target.toString(), { 
    value: hre.ethers.parseEther(".01"), // this is gonna take base-sep eth from our metamask wallet and deposit it into the paymaster
  }); 
  console.log("\nPM funded successfully"); // tofix

  const amountInWei = await ep.balanceOf(pm.target.toString());
  console.log("\nPM balance in Wei:",
      amountInWei
  );
  const amountInEther = Number(amountInWei) / Number(BigInt("1000000000000000000"));
  const amountInEtherWithDecimals = amountInEther.toFixed(18);
  console.log("PM balance in Eth:",
      amountInEtherWithDecimals
  );

  // deploy account-factory
  const af = await hre.ethers.deployContract("contracts/src/Account.sol:AccountFactory", [], { signer: faucet }); 
  await af.waitForDeployment(); 
  console.log(`\nAF: ${af.target}`); 
  envConfig.ACCOUNT_FACTORY_ADDRESS = af.target.toString();

  // delete keypairs since we are making a new deployment and the old keypairs will be not valid anymore
  let dirPath = path.join(__dirname, '../../apps/version2_private_transfers/keypair/');
  try {
    fs.rmSync(dirPath, { recursive: true, force: true });
} catch (err) {
    console.error(`Error while deletion of ${dirPath}:`, err);
}

  // write new addresses to .env file
  const updatedEnv = Object.entries(envConfig).map(([key, value]) => `${key}=${value}`).join('\n');
  fs.writeFileSync('.env', updatedEnv);
  
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });