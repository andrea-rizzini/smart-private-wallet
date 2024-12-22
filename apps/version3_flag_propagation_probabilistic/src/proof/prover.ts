// @ts-ignore
import { utils } from 'ffjavascript'
// @ts-ignore
import * as snarkjs from 'snarkjs'
import { toFixedHex } from '../utils/toHex'

async function prove(input: never, wasm: File, zkey: File) {
  try {
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(utils.stringifyBigInts(input), wasm, zkey)

    const proofHex =
      '0x' +
      toFixedHex(proof.pi_a[0]).slice(2) +
      toFixedHex(proof.pi_a[1]).slice(2) +
      toFixedHex(proof.pi_b[0][1]).slice(2) +
      toFixedHex(proof.pi_b[0][0]).slice(2) +
      toFixedHex(proof.pi_b[1][1]).slice(2) +
      toFixedHex(proof.pi_b[1][0]).slice(2) +
      toFixedHex(proof.pi_c[0]).slice(2) +
      toFixedHex(proof.pi_c[1]).slice(2)

    return {
      proof: proofHex,
      publicSignals: publicSignals
    }
  } catch (err: any) {
    // throw new Error(err.message)
  }
}

async function proveBloom(input: never, wasm: File, zkey: File) {
  try {
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(utils.stringifyBigInts(input), wasm, zkey)

    const proofHex =
      '0x' +
      toFixedHex(proof.pi_a[0]).slice(2) +
      toFixedHex(proof.pi_a[1]).slice(2) +
      toFixedHex(proof.pi_b[0][1]).slice(2) +
      toFixedHex(proof.pi_b[0][0]).slice(2) +
      toFixedHex(proof.pi_b[1][1]).slice(2) +
      toFixedHex(proof.pi_b[1][0]).slice(2) +
      toFixedHex(proof.pi_c[0]).slice(2) +
      toFixedHex(proof.pi_c[1]).slice(2)

    return {
      proofBloom: proofHex,
      publicSignalsBloom: publicSignals
    }
  } catch (err: any) {
    // throw new Error(err.message)
  }
}

async function proveRaw(input: never, wasm: File, zkey: File) {
  try {
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(utils.stringifyBigInts(input), wasm, zkey)

    return {
      proof: proof,
      publicSignals: publicSignals
    }
  } catch (err: any) {
    throw new Error(err.message)
  }
}

export { prove, proveBloom, proveRaw }