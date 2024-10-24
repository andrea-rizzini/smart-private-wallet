import { Wallet, BigNumberish } from 'ethers'
import { encrypt, decrypt, getEncryptionPublicKey } from 'eth-sig-util'
import { toFixedHex } from '../utils/toHex'
import { packEncryptedMessage, unpackEncryptedMessage } from './crypto'
import { BaseKeypair, KeypairStatic } from './types'
import { poseidonHash } from '../utils/hashFunctions'

const PUB_KEY_LENGTH = 64
const STRING_WITH_0X_LENGTH = 130
const ENCRYPTION_KEY_LENGTH = 128

class Keypair extends KeypairStatic implements BaseKeypair {
  public privkey: string 
  public pubkey: bigint 
  public encryptionKey: string

  public constructor(privkey = Wallet.createRandom().privateKey) { // generated using ethers
    super()

    this.privkey = privkey 
    this.pubkey = poseidonHash([privkey]) 
    this.encryptionKey = getEncryptionPublicKey(privkey.slice(2)) 
  }

  public toString() {
    return toFixedHex(this.pubkey) + Buffer.from(this.encryptionKey, 'base64').toString('hex')
  }

  public address() {
    return this.toString()
  }

  public static fromString(str: string) {
    if (str.length === STRING_WITH_0X_LENGTH) {
      str = str.slice(2)
    }

    if (str.length !== ENCRYPTION_KEY_LENGTH) {
      throw new Error('Invalid key length')
    }

    return Object.assign(new Keypair(), {
      privkey: null,
      pubkey: BigInt('0x' + str.slice(0, PUB_KEY_LENGTH)),
      encryptionKey: Buffer.from(str.slice(PUB_KEY_LENGTH, ENCRYPTION_KEY_LENGTH), 'hex').toString('base64'),
    })
  }

  public encrypt(bytes: Buffer) {
    return packEncryptedMessage(encrypt(this.encryptionKey, { data: bytes.toString('base64') }, 'x25519-xsalsa20-poly1305'))
  }

  public decrypt(data: string) {
    return Buffer.from(decrypt(unpackEncryptedMessage(data), this.privkey.slice(2)), 'base64')
  }

  public sign(commitment: BigInt, merklePath: BigNumberish) {
    return poseidonHash([this.privkey, commitment, merklePath])
  }
}

export { Keypair }
