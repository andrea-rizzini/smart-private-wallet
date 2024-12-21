import hre from "hardhat";
import * as fs from 'fs';
import * as path from 'path';

import { call_userop } from "../userop/createUserOp";
import { checkSanctionedAddress } from '../poi/checkIfSanctioned';
import { bits2Num, computeBloomIndices, createBitArray} from "../utils/bloomUtils";
import { getMaskedCommitments, updateMaskedCommitmentFlagged } from '../../database/database';
import  { prove } from "../proof/prover";
import { toFixedHex } from "../utils/toHex";

const AUTHORITY_ADDRESS = process.env.AUTHORITY_ADDRESS || '';
const FILTER_SIZE = 16384;
const INIT_CODE_AUTHORITY = process.env.INIT_CODE_AUTHORITY || '';
const MIXER_ONBOARDING_AND_TRANSFERS_V3_PROBABILISTIC = process.env.MIXER_ONBOARDING_AND_TRANSFERS_V3_PROBABILISTIC || '';

async function main() {

    console.log("The authority performs a transitivity check on each address stored in the offchain database");
    console.log("If the address is found to be sanctioned, the authority flags the masked commitments related to that address in the status tree.");
    console.log("This should be an automated process, but for the sake of this demo, we will perform the check just on program call.");

    // reading of this table must be restritcted only to the authority
    const maskedCommitments: any = getMaskedCommitments();

    for (const maskedCommitment of maskedCommitments) {

        if (maskedCommitment.flagged === 0) {

            const { sanction, message } = await checkSanctionedAddress(maskedCommitment.depositorAddress, 2);
            
            if (sanction) {
                console.log(`\nFlagging masked commitment ${toFixedHex(maskedCommitment.maskedCommitment)} on the status SMT`);
                
                // generate zk-proof, proving that the authority has the right to flag the commitment
                const input = {
                    maskedCommitment: maskedCommitment.maskedCommitment,
                    commitment: maskedCommitment.commitment,
                    blinding: maskedCommitment.blinding,
                }

                // const indices = await computeBloomIndices(input.maskedCommitment, FILTER_SIZE);
                // const chainstateBitArray = createBitArray(FILTER_SIZE, indices);
                // const value = bits2Num(chainstateBitArray);

                let dirPath = path.join(__dirname, `../../../../circuits/artifacts/circuits/`);
                let fileName = `mask_commitment.wasm`;
                let filePath = path.join(dirPath, fileName);
                let wasmBuffer = fs.readFileSync(filePath);

                fileName = `mask_commitment.zkey`;
                filePath = path.join(dirPath, fileName);
                let zKeyBuffer = fs.readFileSync(filePath);

                // @ts-ignore
                const { proof, publicSignals } = await prove(input, wasmBuffer, zKeyBuffer)

                // insert to the status tree
                const signers = await hre.ethers.getSigners();                                                        
                await call_userop("Authority", "callFlagStatus", [MIXER_ONBOARDING_AND_TRANSFERS_V3_PROBABILISTIC, proof, maskedCommitment.id, toFixedHex(input.maskedCommitment)], AUTHORITY_ADDRESS, INIT_CODE_AUTHORITY, signers[4]);
            
                // update to true in the database
                updateMaskedCommitmentFlagged(maskedCommitment.maskedCommitment);

                await new Promise(resolve => setTimeout(resolve, 7000)); // to avoid nonce collision
            }
        }
    }

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })