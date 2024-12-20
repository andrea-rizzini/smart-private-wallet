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

export type ArgsSMT = {
  proofs: BytesLike []
  root: BytesLike
}

export type ArgsPOI = {
  proof: BytesLike
  root: BytesLike
}

export type ProofParams = {
  inputs: BaseUtxo[]
  outputs: BaseUtxo[]
  // eslint-disable-next-line
  tree: any
  // eslint-disable-next-line
  smt: any
  extAmount: bigint
  recipient: string | bigint
  address?: string
  addressSender?: string
}

type CommitmentEvent = {
  blockNumber: number
  transactionHash: string
  index: number
  commitment: string
  encryptedOutput: string
  encryptedChainState: string
}

export type CommitmentEvents = CommitmentEvent[]

type StatusTreeEvent = {
  blockNumber: number 
  transactionHash: string
  index: number
  maskedCommitment: string
}

export type StatusTreeEvents = StatusTreeEvent[]

export type CachedData = {
  latestBlock: number
  commitments: CommitmentEvents
}

export type PrepareTxParams = {
  outputs?: BaseUtxo[]
  inputs?: BaseUtxo[]
  relayer?: string | bigint
  rootHex?: string
  rootSMT ?: string
  recipient?: string | bigint
  events?: CommitmentEvents
  eventsStatusTree?: StatusTreeEvents
  address ?: string
  addressSender?: string
}

export type CreateTransactionParams = {
  outputs?: BaseUtxo[]
  inputs?: BaseUtxo[]
  fee?: bigint
  relayer?: string | bigint
  recipient?: string | bigint
  rootHex?: string
  rootSMT ?: string
  events?: CommitmentEvents
  eventsStatusTree?: StatusTreeEvents
  address ?: string
  addressSender?: string
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

export type Chainstate = {
  chainstateBitArray: number[]
}

// export type ChainStates = Chainstate[]

export interface BaseUtxo {
  keypair: BaseKeypair
  amount: bigint
  blinding: bigint
  index: number
  commitment?: bigint
  nullifier?: bigint
  chainState: Chainstate

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
  encryptedChainState1: string
  encryptedChainState2: string
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