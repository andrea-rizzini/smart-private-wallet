import { EthEncryptedData } from 'eth-sig-util'

const BYTES_32 = 32
const NONCE_BUF_LENGTH = 24
const EPHEM_PUBLIC_KEY_BUF_LENGTH = 56

export function packEncryptedMessage(encryptedData: EthEncryptedData) {
    const nonceBuf = Buffer.from(encryptedData.nonce, 'base64')
    const ephemPublicKeyBuf = Buffer.from(encryptedData.ephemPublicKey, 'base64')
    const ciphertextBuf = Buffer.from(encryptedData.ciphertext, 'base64')
  
    const messageBuff = Buffer.concat([
      Buffer.alloc(NONCE_BUF_LENGTH - nonceBuf.length),
      nonceBuf,
      Buffer.alloc(BYTES_32 - ephemPublicKeyBuf.length),
      ephemPublicKeyBuf,
      ciphertextBuf,
    ])
  
    return '0x' + messageBuff.toString('hex')
  }

  export function unpackEncryptedMessage(encryptedMessage: string) {
    if (encryptedMessage.slice(0, 2) === '0x') {
      encryptedMessage = encryptedMessage.slice(2)
    }
  
    const messageBuff = Buffer.from(encryptedMessage, 'hex')
    const nonceBuf = messageBuff.slice(0, NONCE_BUF_LENGTH)
    const ephemPublicKeyBuf = messageBuff.slice(NONCE_BUF_LENGTH, EPHEM_PUBLIC_KEY_BUF_LENGTH)
    const ciphertextBuf = messageBuff.slice(EPHEM_PUBLIC_KEY_BUF_LENGTH)
  
    return {
      version: 'x25519-xsalsa20-poly1305',
      nonce: nonceBuf.toString('base64'),
      ephemPublicKey: ephemPublicKeyBuf.toString('base64'),
      ciphertext: ciphertextBuf.toString('base64'),
    }
  }