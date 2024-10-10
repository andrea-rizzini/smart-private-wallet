import dotenv from 'dotenv';
import fs from 'fs';
import hre from 'hardhat';

const USDC_ADDRESS: string = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'

async function main () {
    
    const envConfig = dotenv.parse(fs.readFileSync('.env'));

    const VERIFIER_ONBOARDING = process.env.VERIFIER_ONBOARDING || '';
    const HASHER_ONBOARDING = process.env.HASHER_ONBOARDING || '';

    const signers = await hre.ethers.getSigners();
    const faucet = signers[2];    

    const mixer = await hre.ethers.getContractFactory("OnboardingMixerArbitraryDenomination", faucet);

    const mixer_test = await mixer.deploy(VERIFIER_ONBOARDING, HASHER_ONBOARDING, USDC_ADDRESS, 20);
    await mixer_test.waitForDeployment();
    console.log(`Mixer for arbitrary denomination deployed at: ${mixer_test.target}`);
    envConfig.ONBOARDING_MIXER_ARBITRARY_DENOMINATION = mixer_test.target.toString();
    
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