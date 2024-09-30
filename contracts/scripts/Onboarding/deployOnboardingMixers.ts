import dotenv from 'dotenv';
import fs from 'fs';
import hre from 'hardhat';
import path from 'path';
import { clearJsonFile } from '../../../apps/version1_onboarding/src/utils/clearJsonFile';

async function main () {

    // delete cache files content, for the moment files are just for 0.01 eth commitments
    let dirPath = path.join(__dirname, '../../../apps/version1_onboarding/cache/');
    let fileName = `CommitmentCreated_eth_0.01.json`;
    let filePath = path.join(dirPath, fileName);
    clearJsonFile(filePath);

    dirPath = path.join(__dirname, '../../../apps/version2_private_transfers/cache/');
    fileName = `CommitmentCreated_eth_0.01.json`;
    filePath = path.join(dirPath, fileName);
    clearJsonFile(filePath);

    dirPath = path.join(__dirname, '../../../apps/version3_compliance/cache/');
    fileName = `CommitmentCreated_eth_0.01.json`;
    filePath = path.join(dirPath, fileName);
    clearJsonFile(filePath);

    dirPath = path.join(__dirname, '../../../apps/version1_onboarding/cache/');
    fileName = `CommitmentCreated_eth_0.1.json`;
    filePath = path.join(dirPath, fileName);
    clearJsonFile(filePath);

    dirPath = path.join(__dirname, '../../../apps/version2_private_transfers/cache/');
    fileName = `CommitmentCreated_eth_0.1.json`;
    filePath = path.join(dirPath, fileName);
    clearJsonFile(filePath);

    dirPath = path.join(__dirname, '../../../apps/version3_compliance/cache/');
    fileName = `CommitmentCreated_eth_0.1.json`;
    filePath = path.join(dirPath, fileName);
    clearJsonFile(filePath);

    dirPath = path.join(__dirname, '../../../apps/version1_onboarding/cache/');
    fileName = `CommitmentCreated_eth_1.json`;
    filePath = path.join(dirPath, fileName);
    clearJsonFile(filePath);

    dirPath = path.join(__dirname, '../../../apps/version2_private_transfers/cache/');
    fileName = `CommitmentCreated_eth_1.json`;
    filePath = path.join(dirPath, fileName);
    clearJsonFile(filePath);

    dirPath = path.join(__dirname, '../../../apps/version3_compliance/cache/');
    fileName = `CommitmentCreated_eth_1.json`;
    filePath = path.join(dirPath, fileName);
    clearJsonFile(filePath);

    dirPath = path.join(__dirname, '../../../apps/version1_onboarding/cache/');
    fileName = `CommitmentCreated_eth_10.json`;
    filePath = path.join(dirPath, fileName);
    clearJsonFile(filePath);

    dirPath = path.join(__dirname, '../../../apps/version2_private_transfers/cache/');
    fileName = `CommitmentCreated_eth_10.json`;
    filePath = path.join(dirPath, fileName);
    clearJsonFile(filePath);

    dirPath = path.join(__dirname, '../../../apps/version3_compliance/cache/');
    fileName = `CommitmentCreated_eth_10.json`;
    filePath = path.join(dirPath, fileName);
    clearJsonFile(filePath);
    
    const envConfig = dotenv.parse(fs.readFileSync('.env'));

    const VERIFIER_ONBOARDING = process.env.VERIFIER_ONBOARDING || '';
    const HASHER_ONBOARDING = process.env.HASHER_ONBOARDING || '';

    const signers = await hre.ethers.getSigners();
    const faucet = signers[2];    

    const mixer = await hre.ethers.getContractFactory("OnboardingMixer", faucet);

    const mixer_test = await mixer.deploy(VERIFIER_ONBOARDING, HASHER_ONBOARDING, hre.ethers.parseEther("0.01"), 20);
    await mixer_test.waitForDeployment();
    console.log(`Mixer test deployed at: ${mixer_test.target}`);
    envConfig.ONBOARDING_MIXER_ADDRESS_TEST = mixer_test.target.toString();
    // await run(`verify:verify`, {
    //   address: mixer_high_denomination.target,
    //   constructorArguments: [VERIFIER_ONBOARDING, HASHER_ONBOARDING, hre.ethers.parseEther("10"), 20],
    // });

    const mixer_low_denomination= await mixer.deploy(VERIFIER_ONBOARDING, HASHER_ONBOARDING, hre.ethers.parseEther("0.1"), 20);
    await mixer_low_denomination.waitForDeployment();
    console.log(`Mixer low denomination deployed at: ${mixer_low_denomination.target}`);
    envConfig.ONBOARDING_MIXER_ADDRESS_LOW = mixer_low_denomination.target.toString();
    // await run(`verify:verify`, {
    //   address: mixer_high_denomination.target,
    //   constructorArguments: [VERIFIER_ONBOARDING, HASHER_ONBOARDING, hre.ethers.parseEther("10"), 20],
    // });


    const mixer_medium_denomination= await mixer.deploy(VERIFIER_ONBOARDING, HASHER_ONBOARDING, hre.ethers.parseEther("1"), 20);
    await mixer_medium_denomination.waitForDeployment();
    console.log(`Mixer medium denomination deployed at: ${mixer_medium_denomination.target}`);
    envConfig.ONBOARDING_MIXER_ADDRESS_MEDIUM = mixer_medium_denomination.target.toString();
    // await run(`verify:verify`, {
    //   address: mixer_high_denomination.target,
    //   constructorArguments: [VERIFIER_ONBOARDING, HASHER_ONBOARDING, hre.ethers.parseEther("10"), 20],
    // });


    const mixer_high_denomination= await mixer.deploy(VERIFIER_ONBOARDING, HASHER_ONBOARDING, hre.ethers.parseEther("10"), 20);
    await mixer_high_denomination.waitForDeployment();
    console.log(`Mixer high denomination deployed at: ${mixer_high_denomination.target}`);
    envConfig.ONBOARDING_MIXER_ADDRESS_HIGH = mixer_high_denomination.target.toString();
    // await run(`verify:verify`, {
    //   address: mixer_high_denomination.target,
    //   constructorArguments: [VERIFIER_ONBOARDING, HASHER_ONBOARDING, hre.ethers.parseEther("10"), 20],
    // });

    // write new addresses to .env file
    const updatedEnv = Object.entries(envConfig).map(([key, value]) => `${key}=${value}`).join('\n');
    fs.writeFileSync('.env', updatedEnv);

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })