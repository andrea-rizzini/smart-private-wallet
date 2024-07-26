// @ts-ignore
import * as snarkjs from 'snarkjs';
const bigInt = snarkjs.bigInt;
import { createDeposit } from '../createNote';

export async function parseNote(noteString: string) {
    const noteRegex = /note-(?<currency>\w+)-(?<amount>[\d.]+)-(?<netId>\d+)-0x(?<note>[0-9a-fA-F]{124})/g
    
    const match = noteRegex.exec(noteString);
    if (!match || !match.groups) {
        throw new Error('The note has invalid format');
    }

    const { note, netId, currency, amount } = match.groups;

    const buf = Buffer.from(note, 'hex');
    const nullifier = bigInt.leBuff2int(buf.slice(0, 31));
    const secret = bigInt.leBuff2int(buf.slice(31, 62));
    const deposit = createDeposit({ nullifier, secret });

    return {
        currency,
        amount,
        netId: Number(netId),
        deposit
    };
}