import crypto from "crypto"
import { toHex } from "../utils/toHex";
// @ts-ignore
import * as circomlib from "circomlib";

const netId = "84532" // Base Sepolia net id
const currency = "usdc"

const pedersenHash = (data: Buffer) => circomlib.babyJub.unpackPoint(circomlib.pedersenHash.hash(data))[0]
const rbigint = (nbytes: number) => BigInt('0x' + crypto.randomBytes(nbytes).toString('hex'))   

interface Deposit {
    nullifier: any;
    secret: any;
    preimage?: any;
    commitment?: any;
    commitmentHex?: any;
    nullifierHash?: any;
    nullifierHex?: any;
}

export function createDeposit({ nullifier, secret }: { nullifier: bigint; secret: bigint }): Deposit {
    const deposit: Deposit = { nullifier, secret };
    deposit.preimage = Buffer.concat([deposit.nullifier.leInt2Buff(31), deposit.secret.leInt2Buff(31)])
    deposit.commitment = pedersenHash(deposit.preimage)
    deposit.commitmentHex = toHex(deposit.commitment)
    deposit.nullifierHash = pedersenHash(deposit.nullifier.leInt2Buff(31))
    deposit.nullifierHex = toHex(deposit.nullifierHash)
    return deposit
}

export async function createNote(ethValue: string): Promise<{ noteString: string; nullifierHex: string; commitmentHex: string }> {
    const deposit = createDeposit({ nullifier: rbigint(31), secret: rbigint(31) });
    const commitmentHex = deposit.commitmentHex || "";
    const note = toHex(deposit.preimage, 62);
    const nullifierHex = deposit.nullifierHex || "";
    const noteString = `note-${currency}-${ethValue}-${netId}-${note}`;
    
    return { noteString, nullifierHex, commitmentHex };
}
