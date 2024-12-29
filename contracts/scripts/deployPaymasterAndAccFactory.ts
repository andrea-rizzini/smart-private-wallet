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
    value: hre.ethers.parseEther(".015"), // this is gonna take base-sep eth from our metamask wallet and deposit it into the paymaster
  }); 
  console.log("\nPM funded successfully"); // tofix

  // deploy account factories for v2 and v3
  const af_v2 = await hre.ethers.deployContract("contracts/src/Account.sol:AccountFactory", [], { signer: faucet }); 
  await af_v2.waitForDeployment(); 
  console.log(`\nAF_V2: ${af_v2.target}`); 
  envConfig.ACCOUNT_FACTORY_ADDRESS = af_v2.target.toString();3

  const af_v2_relayer = await hre.ethers.deployContract("contracts/src/Transfers/Relayer.sol:AccountFactory", [], { signer: faucet });
  await af_v2_relayer.waitForDeployment();
  console.log(`\nAF_V2_RELAYER: ${af_v2_relayer.target}`);
  envConfig.ACCOUNT_FACTORY_RELAYER_ADDRESS = af_v2_relayer.target.toString();

  // const af_v3 = await hre.ethers.deployContract("contracts/src/FlagPropagation/AccountForV3.sol:AccountFactory", [], { signer: faucet });
  // await af_v3.waitForDeployment();
  // console.log(`\nAF_V3: ${af_v3.target}`);
  // envConfig.ACCOUNT_FACTORY_V3_ADDRESS = af_v3.target.toString();

  // const af_v3_relayer = await hre.ethers.deployContract("contracts/src/FlagPropagation/RelayerForV3.sol:AccountFactory", [], { signer: faucet });
  // await af_v3_relayer.waitForDeployment();
  // console.log(`\nAF_V3_RELAYER: ${af_v3_relayer.target}`);
  // envConfig.ACCOUNT_FACTORY_V3_RELAYER_ADDRESS = af_v3_relayer.target.toString();

  // const af_v3_authority = await hre.ethers.deployContract("contracts/src/FlagPropagation/Authority.sol:AccountFactory", [], { signer: faucet });
  // await af_v3_authority.waitForDeployment();
  // console.log(`\nAF_V3_AUTHORITY: ${af_v3_authority.target}`);
  // envConfig.ACCOUNT_FACTORY_V3_AUTHORITY_ADDRESS = af_v3_authority.target.toString();

  // deploy account factories for v3-probabilistic

  // const af_v3_probabilistic = await hre.ethers.deployContract("contracts/src/FlagPropagationProbabilistic/AccountForV3Probabilistic.sol:AccountFactory", [], { signer: faucet });
  // await af_v3_probabilistic.waitForDeployment();
  // console.log(`\nAF_V3_PROBABILISTIC: ${af_v3_probabilistic.target}`);
  // envConfig.ACCOUNT_FACTORY_V3_PROBABILISTIC_ADDRESS = af_v3_probabilistic.target.toString();

  // const af_v3_relayer_probabilistic = await hre.ethers.deployContract("contracts/src/FlagPropagationProbabilistic/RelayerForV3Probabilistic.sol:AccountFactory", [], { signer: faucet });
  // await af_v3_relayer_probabilistic.waitForDeployment();
  // console.log(`\nAF_V3_RELAYER_PROBABILISTIC: ${af_v3_relayer_probabilistic.target}`);
  // envConfig.ACCOUNT_FACTORY_V3_RELAYER_PROBABILISTIC_ADDRESS = af_v3_relayer_probabilistic.target.toString();

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