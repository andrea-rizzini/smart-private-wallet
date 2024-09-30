import dotenv from 'dotenv';
import fs from 'fs';
import hre from "hardhat";

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

  // deploy account-factory for v1 and v2
  const af = await hre.ethers.deployContract("contracts/src/Account.sol:AccountFactory", [], { signer: faucet }); 
  await af.waitForDeployment(); 
  console.log(`\nAF: ${af.target}`); 
  envConfig.ACCOUNT_FACTORY_ADDRESS = af.target.toString();

  // deploy account-factory for v3
  const af_v3 = await hre.ethers.deployContract("contracts/src/AccountForV3.sol:AccountFactory", [], { signer: faucet }); 
  await af_v3.waitForDeployment(); 
  console.log(`\nAF_V3: ${af_v3.target}`); 
  envConfig.ACCOUNT_FACTORY_V3_ADDRESS = af_v3.target.toString();

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