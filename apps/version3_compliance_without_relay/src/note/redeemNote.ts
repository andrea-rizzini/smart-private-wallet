import { LinkNote } from "../types/link";
import { parseNote } from "./parseNote";
import { generateMixerProof } from "../proof/generateMixerProof";
import { call_userop } from "../userop/createUserOp";

const ONBOARDING_MIXER_ADDRESS_TEST = process.env.ONBOARDING_MIXER_ADDRESS_TEST || '';
const ONBOARDING_MIXER_ADDRESS_LOW = process.env.ONBOARDING_MIXER_ADDRESS_LOW || '';
const ONBOARDING_MIXER_ADDRESS_MEDIUM = process.env.ONBOARDING_MIXER_ADDRESS_MEDIUM || '';
const ONBOARDING_MIXER_ADDRESS_HIGH = process.env.ONBOARDING_MIXER_ADDRESS_HIGH || '';

export async function redeem(link: LinkNote, account: string, initCode: string, signer: any) {

    const note: string = link.note;
    const noteParsed = await parseNote(note);

    const amount: number = Number(noteParsed.amount);
    const deposit = noteParsed.deposit;
    const currency: string = noteParsed.currency;

    let functionName: string = "redeem_commitment";   
    let id: string;

    switch (amount) {
        case 0.01:
          id = ONBOARDING_MIXER_ADDRESS_TEST;
          break;
        case 0.1:
          id = ONBOARDING_MIXER_ADDRESS_LOW;
          break;
        case 1:
          id = ONBOARDING_MIXER_ADDRESS_MEDIUM;
          break;
        case 10:
          id = ONBOARDING_MIXER_ADDRESS_HIGH;
          break;
        default:
          functionName = '';  
          id = '';
    }

    const { proof, args } = await generateMixerProof({ deposit, currency, amount, account});

    const code = await hre.ethers.provider.getCode(account); // get the bytecode of the smart account
    if (code !== "0x") {
      initCode = "0x";
    }

    await call_userop(functionName, [id, proof, args[0], args[1], args[2]], account, initCode, signer);

}