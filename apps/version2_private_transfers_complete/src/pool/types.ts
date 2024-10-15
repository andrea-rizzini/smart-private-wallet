import { BigNumberish } from 'ethers'
import { BytesLike } from '@ethersproject/bytes'

export type ArgsProof = {
  proof: BytesLike
  root: BytesLike
  inputNullifiers: string[]
  outputCommitments: [BytesLike, BytesLike]
  publicAmount: BigNumberish
  extDataHash: string
}

export type ProofParams = {
  inputs: BaseUtxo[]
  outputs: BaseUtxo[]
  // eslint-disable-next-line
  tree: any
  extAmount: bigint
  recipient: string | bigint
}

type CommitmentEvent = {
  blockNumber: number
  transactionHash: string
  index: number
  commitment: string
  encryptedOutput: string
}

export type CommitmentEvents = CommitmentEvent[]

type CommitmentPOIEvent = {
  blockNumber: number
  transactionHash: string
  index: number
  commitment: string
}

export type CommitmentPOIEvents = CommitmentPOIEvent[]

export type CachedData = {
  latestBlock: number
  commitments: CommitmentEvents
}

export type PrepareTxParams = {
  outputs?: BaseUtxo[]
  inputs?: BaseUtxo[]
  relayer?: string | bigint
  rootHex?: string
  recipient?: string | bigint
  events?: CommitmentEvents
}

export type CreateTransactionParams = {
  outputs?: BaseUtxo[]
  inputs?: BaseUtxo[]
  fee?: bigint
  relayer?: string | bigint
  recipient?: string | bigint
  rootHex?: string
  events?: CommitmentEvents
  isL1Withdrawal?: boolean
  l1Fee?: bigint
}

export interface BaseKeypair {
  privkey: string
  pubkey: bigint
  encryptionKey: string

  toString: () => string
  address: () => string
  encrypt: (bytes: Buffer) => string
  decrypt: (data: string) => Buffer
  sign: (commitment: bigint, merklePath: BigNumberish) => bigint
}

export abstract class KeypairStatic {
  // @ts-expect-error
  static fromString(str: string): BaseKeypair
}

export abstract class UtxoStatic {
  // @ts-expect-error
  static decrypt(keypair: BaseKeypair, data: string, index: number): BaseUtxo
}

export interface BaseUtxo {
  keypair: BaseKeypair
  amount: bigint
  blinding: bigint
  index: number
  commitment?: bigint
  nullifier?: bigint

  getNullifier: () => bigint
  getCommitment: () => bigint
  encrypt: () => string
}

export interface UtxoOptions {
  amount?: bigint | number | string
  blinding?: bigint
  index?: number
  keypair?: BaseKeypair
}

export interface Params {
  recipient: string // address || 0
  encryptedOutput1: string
  extAmount: string
  encryptedOutput2: string
}

export type CustomUtxo = BaseUtxo & { transactionHash: string }

export type UnspentUtxoData = {
  totalAmount: BigInt
  unspentUtxo: CustomUtxo[]
  accountAddress?: string
}

type DecryptedEvent = {
  nullifierHash: string
  blockNumber: number
  index: string
  blinding: string
  amount: string
  commitment: string
  nullifier: string
  transactionHash: string
}

export type DecryptedEvents = DecryptedEvent[]

export type FetchUnspentUtxoRes = UnspentUtxoData & {
  freshUnspentUtxo: CustomUtxo[]
  freshDecryptedEvents: DecryptedEvents
}