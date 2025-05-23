// @ts-ignore
import { utils } from 'ffjavascript'
// @ts-ignore
import * as snarkjs from 'snarkjs'
import { toFixedHex } from '../utils/toHex' 

async function prove(input: never, wasm: File, zkey: File) {
  try {
    const { proof } = await snarkjs.groth16.fullProve(utils.stringifyBigInts(input), wasm, zkey)
    return (
      '0x' +
      toFixedHex(proof.pi_a[0]).slice(2) +
      toFixedHex(proof.pi_a[1]).slice(2) +
      toFixedHex(proof.pi_b[0][1]).slice(2) +
      toFixedHex(proof.pi_b[0][0]).slice(2) +
      toFixedHex(proof.pi_b[1][1]).slice(2) +
      toFixedHex(proof.pi_b[1][0]).slice(2) +
      toFixedHex(proof.pi_c[0]).slice(2) +
      toFixedHex(proof.pi_c[1]).slice(2)
    )
  } catch (err: any) {
    throw new Error(err.message)
  }
}

export { prove }
