import dotenv from 'dotenv';
import fs from 'fs';
import hre from 'hardhat';
import path from 'path';
import { run } from "hardhat";
import { clearJsonFile } from '../../../apps/version2_private_transfers/src/utils/clearsonFile';
const USDC_ADDRESS: string = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'

async function main () {

    // delete cache files content, for the moment files are just for 0.01 eth commitments
    let dirPath = path.join(__dirname, '../../../apps/version2_private_transfers/cache/');
    let fileName = `CommitmentCreated_arbitrary_denom.json`;
    let filePath = path.join(dirPath, fileName);
    clearJsonFile(filePath);
    
    const envConfig = dotenv.parse(fs.readFileSync('.env'));

    const AUTHORITY_ADDRESS = process.env.AUTHORITY_ADDRESS || '';
    const VERIFIER_2 = process.env.VERIFIER_2 || '';
    const VERIFIER_16 = process.env.VERIFIER_16 || '';
    const VERIFIER_POI_2 = process.env.VERIFIER_POI_2 || '';
    const VERIFIER_POI_16 = process.env.VERIFIER_POI_16 || '';
    const VERIFIER_MASKED_COMMITMENT = process.env.VERIFIER_MASKED_COMMITMENT || '';
    const HASHER_TRANSFERS = process.env.HASHER_TRANSFERS || '';

    const signers = await hre.ethers.getSigners();
    const faucet = signers[2];    

    const mixer = await hre.ethers.getContractFactory("MixerOnboardingAndTransfers", faucet);

    const mixer_onb_and_transf = await mixer.deploy(VERIFIER_2, VERIFIER_16, VERIFIER_POI_2, VERIFIER_POI_16, VERIFIER_MASKED_COMMITMENT, HASHER_TRANSFERS, USDC_ADDRESS, 20, AUTHORITY_ADDRESS);
    await mixer_onb_and_transf.waitForDeployment();
    console.log(`Mixer for oboarding and transfers deployed at: ${mixer_onb_and_transf.target}`);
    envConfig.MIXER_ONBOARDING_AND_TRANSFERS = mixer_onb_and_transf.target.toString();

    // await run(`verify:verify`, {
    //     address: mixer_onb_and_transf.target,
    //     constructorArguments: [VERIFIER_2, VERIFIER_16, VERIFIER_POI_2, VERIFIER_POI_16, VERIFIER_MASKED_COMMITMENT, HASHER_TRANSFERS, USDC_ADDRESS, 20, AUTHORITY_ADDRESS],
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