import { UtxoStatic, BaseUtxo, BaseKeypair, UtxoOptions } from './types'
import { Keypair } from './keypair'
import crypto from 'crypto'
import { poseidonHash } from '../utils/hashFunctions'

const BYTES_31 = 31
const BYTES_62 = 62

function randomBN(nbytes = BYTES_31) {
    return BigInt('0x' + crypto.randomBytes(nbytes).toString('hex'))
}

function toBuffer(value: string | number | BigInt, length: number) {
  let hexString = value.toString(16);
  hexString = hexString.padStart(length * 2, '0');
  return Buffer.from(hexString, 'hex');
}

class Utxo extends UtxoStatic implements BaseUtxo {
  public keypair: BaseKeypair
  public amount: bigint
  public transactionHash?: string
  public blinding: bigint
  public index: number
  public commitment?: bigint
  public nullifier?: bigint

  public static decrypt(keypair: BaseKeypair, data: string, index: number): BaseUtxo {
    const buf = keypair.decrypt(data)

    return new Utxo({
      amount: BigInt('0x' + buf.slice(0, BYTES_31).toString('hex')),
      blinding: BigInt('0x' + buf.slice(BYTES_31, BYTES_62).toString('hex')),
      keypair,
      index,
    })
  }

  public constructor({
    amount = BigInt(0),
    keypair = new Keypair(),
    blinding = randomBN(),
    index = 0,
  }: UtxoOptions = {}) {
    super()

    this.amount = BigInt(String(amount))
    this.blinding = BigInt(String(blinding))
    this.keypair = keypair
    this.index = index
  }

  public getCommitment() {
    if (this.commitment == null) {
      this.commitment = poseidonHash([this.amount, this.keypair.pubkey, this.blinding])
    }
    return this.commitment
  }

  public getNullifier() {
    if (this.nullifier == null) {
      // eslint-disable-next-line eqeqeq
      if (this.amount > 0 && (this.index == undefined || this.keypair.privkey == undefined)) {
        throw new Error('Can not compute nullifier without utxo index or shielded key')
      }
      const signature = this.keypair.privkey ? this.keypair.sign(this.getCommitment(), this.index || 0) : 0
      this.nullifier = poseidonHash([this.getCommitment(), this.index || 0, signature])
    }
    return this.nullifier
  }

  public encrypt() {
    const bytes = Buffer.concat([toBuffer(this.amount, BYTES_31), toBuffer(this.blinding, BYTES_31)])
    return this.keypair.encrypt(bytes)
  }
}

export { Utxo }
