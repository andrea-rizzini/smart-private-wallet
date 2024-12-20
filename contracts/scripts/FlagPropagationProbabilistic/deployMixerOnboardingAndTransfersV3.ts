import dotenv from 'dotenv';
import fs from 'fs';
import hre from 'hardhat';
import { run } from "hardhat";
const USDC_ADDRESS: string = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'

async function main () {
    
    const envConfig = dotenv.parse(fs.readFileSync('.env'));

    const AUTHORITY_ADDRESS = process.env.AUTHORITY_ADDRESS || '';
    const VERIFIER_2 = process.env.VERIFIER_2 || '';
    const VERIFIER_16 = process.env.VERIFIER_16 || '';
    const VERIFIER_MASKED_COMMITMENT = process.env.VERIFIER_MASKED_COMMITMENT || '';
    const VERIFIER_NON_MEMBERSHIP = process.env.VERIFIER_NON_MEMBERSHIP || '';
    const HASHER_TRANSFERS = process.env.HASHER_TRANSFERS || '';
    const HASHER_POSEIDON_3_INPUTS = process.env.HASHER_POSEIDON_3_INPUTS || '';

    const signers = await hre.ethers.getSigners();
    const faucet = signers[2];    

    const mixer = await hre.ethers.getContractFactory("contracts/src/FlagPropagation/MixerOnboardingAndTransfersV3Probabilistic.sol:MixerOnboardingAndTransfers", faucet);

    const mixer_onb_and_transf_V3 = await mixer.deploy(VERIFIER_2, VERIFIER_16,  VERIFIER_MASKED_COMMITMENT, VERIFIER_NON_MEMBERSHIP, HASHER_TRANSFERS, HASHER_POSEIDON_3_INPUTS, USDC_ADDRESS, 20, AUTHORITY_ADDRESS);
    await mixer_onb_and_transf_V3.waitForDeployment();
    console.log(`Mixer for oboarding and transfers V3 probabilistic deployed at: ${mixer_onb_and_transf_V3.target}`);
    envConfig.MIXER_ONBOARDING_AND_TRANSFERS_V3_PROBABILISTIC = mixer_onb_and_transf_V3.target.toString();

    //verify the contract
    await run("verify:verify", {
        address: mixer_onb_and_transf_V3.target,
        constructorArguments: [VERIFIER_2, VERIFIER_16,  VERIFIER_MASKED_COMMITMENT, VERIFIER_NON_MEMBERSHIP, HASHER_TRANSFERS, HASHER_POSEIDON_3_INPUTS, USDC_ADDRESS, 20, AUTHORITY_ADDRESS]
    });
    
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