import { call_userop } from "../userop/createUserOp";
import { generateMixerProof } from "../proof/generateMixerProof";
import hre from "hardhat";
import { LinkNote } from "../types/link";
import { parseNote } from "./parseNote";
import { prepareDeposit } from "../pool/poolPrepareActions";

const MIXER_ONBOARDING_AND_TRANSFERS = process.env.MIXER_ONBOARDING_AND_TRANSFERS || '';

export async function redeem(link: LinkNote, account: string, initCode: string, signer: any) {

    const note: string = link.note;
    const noteParsed = await parseNote(note);

    const amount: number = Number(noteParsed.amount);
    const deposit = noteParsed.deposit;

    let id: string = MIXER_ONBOARDING_AND_TRANSFERS;

    const { proof, args } = await generateMixerProof({ deposit, account});

    const result = await prepareDeposit(amount.toString(), account, signer);

    const code = await hre.ethers.provider.getCode(account); // get the bytecode of the smart account
    if (code !== "0x") {
      initCode = "0x";
    }

    if (result){
      //const {args, extData} = result;
      await call_userop("Account", "redeem_commitment", [id, proof, args[0], args[1], result.args, result.extData], account, initCode, signer);
    }
  }