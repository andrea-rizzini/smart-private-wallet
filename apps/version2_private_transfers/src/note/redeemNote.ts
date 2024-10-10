import { call_userop } from "../userop/createUserOp";
import { generateMixerProof } from "../proof/generateMixerProof";
import { LinkNote } from "../types/link";
import { parseNote } from "./parseNote";
import { prepareDeposit } from "../pool/poolPrepareActions";

// const ONBOARDING_MIXER_ADDRESS_TEST = process.env.ONBOARDING_MIXER_ADDRESS_TEST || '';
// const ONBOARDING_MIXER_ADDRESS_LOW = process.env.ONBOARDING_MIXER_ADDRESS_LOW || '';
// const ONBOARDING_MIXER_ADDRESS_MEDIUM = process.env.ONBOARDING_MIXER_ADDRESS_MEDIUM || '';
// const ONBOARDING_MIXER_ADDRESS_HIGH = process.env.ONBOARDING_MIXER_ADDRESS_HIGH || '';
const MIXER_ONBOARDING_AND_TRANSFERS = process.env.MIXER_ONBOARDING_AND_TRANSFERS || '';
const RELAYER_ADDRESS = process.env.RELAYER_ADDRESS || '';
const INIT_CODE_RELAYER = process.env.INIT_CODE_RELAYER || '';

export async function redeem(link: LinkNote, account: string, initCode: string, signer: any) {

    const note: string = link.note;
    const noteParsed = await parseNote(note);

    const amount: number = Number(noteParsed.amount);
    const deposit = noteParsed.deposit;
    const currency: string = noteParsed.currency;

    let id: string = MIXER_ONBOARDING_AND_TRANSFERS;

    // switch (amount) {
    //     case 0.01:
    //       id = ONBOARDING_MIXER_ADDRESS_TEST;
    //       break;
    //     case 0.1:
    //       id = ONBOARDING_MIXER_ADDRESS_LOW;
    //       break;
    //     case 1:
    //       id = ONBOARDING_MIXER_ADDRESS_MEDIUM;
    //       break;
    //     case 10:
    //       id = ONBOARDING_MIXER_ADDRESS_HIGH;
    //       break;
    //     default:
    //       functionName = '';  
    //       id = '';
    // }

    const { proof, args } = await generateMixerProof({ deposit, currency, amount, account});

    const result = await prepareDeposit(amount.toString(), account, signer);

    const code = await hre.ethers.provider.getCode(account); // get the bytecode of the smart account
    if (code !== "0x") {
      initCode = "0x";
    }

    if (result){
      await call_userop("redeem_commitment", [id, proof, args[0], args[1], result.args, result.extData], RELAYER_ADDRESS, INIT_CODE_RELAYER, signer);
    }


}