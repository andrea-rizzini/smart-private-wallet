// @ts-ignore
import * as snarkjs from 'snarkjs';
const bigInt = snarkjs.bigInt;

export function toHex(number: any, length = 32) {
    const str = number instanceof Buffer ? number.toString('hex') : bigInt(number).toString(16)
    return '0x' + str.padStart(length * 2, '0')
 }
