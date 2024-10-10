import dotenv from 'dotenv';
import fs from 'fs';
import hre from 'hardhat';

const USDC_ADDRESS: string = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'

async function main () {
    
    const envConfig = dotenv.parse(fs.readFileSync('.env'));

    const VERIFIER_ONBOARDING = process.env.VERIFIER_ONBOARDING || '';
    const VERIFIER_2 = process.env.VERIFIER_2 || '';
    const VERIFIER_16 = process.env.VERIFIER_16 || '';
    const HASHER_ONBOARDING = process.env.HASHER_ONBOARDING || '';
    const HASHER_TRANSFERS = process.env.HASHER_TRANSFERS || '';

    const signers = await hre.ethers.getSigners();
    const faucet = signers[2];    

    const mixer = await hre.ethers.getContractFactory("MixerOnboardingAndTransfers", faucet);

    const mixer_onb_and_transf = await mixer.deploy(VERIFIER_ONBOARDING, VERIFIER_2, VERIFIER_16, HASHER_ONBOARDING, HASHER_TRANSFERS, USDC_ADDRESS, 20, 20);
    await mixer_onb_and_transf.waitForDeployment();
    console.log(`Mixer for oboarding and transfers deployed at: ${mixer_onb_and_transf.target}`);
    envConfig.MIXER_ONBOARDING_AND_TRANSFERS = mixer_onb_and_transf.target.toString();
    
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