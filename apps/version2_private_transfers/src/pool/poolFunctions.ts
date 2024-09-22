import { BaseUtxo, CreateTransactionParams, CommitmentEvents, PrepareTxParams } from "./types";
import { getKeyPairByUserId, getID } from "../../database/database";
import { getProof } from "../proof/generateTransactionProof";
import hre from "hardhat";
import { Keypair } from "./keypair";
// @ts-ignore
import MerkleTree from 'fixed-merkle-tree';
import { poseidonHash2 } from "../utils/hashFunctions";
import { toFixedHex } from "../utils/toHex";
import { Utxo } from "./utxo";

const contractAddress = process.env.POOL_USERS_ADDRESS || '';
const MERKLE_TREE_HEIGHT = 20;
const UTXOS_POOL_ADDRESS = process.env.UTXOS_POOL_ADDRESS || '';

export async function getUtxoFromKeypair(senderKeyPair: Keypair, addressSender: string){ // this function has to return just unspentUtxo

  // 1) fetch all nullifiers
  const contract = await hre.ethers.getContractAt("UTXOsPool", UTXOS_POOL_ADDRESS);
  let filter = contract.filters.NewNullifier();
  const eventsNullifiers = await contract.queryFilter(filter);

  // 2) fetch all commitment events
  filter = contract.filters.NewCommitment();
  const eventsCommitments = await contract.queryFilter(filter);

  // 3) for each event, take the encrypted output field, decrypt it and if it's owned by the sender, add it to the myUtxo array
  let myUtxo: BaseUtxo[] = []

  eventsCommitments.forEach(event => {
    const index = Number(event.args[1])
    const encryptedOutput = event.args[2]
    try {
      const utxo = Utxo.decrypt(senderKeyPair, encryptedOutput, index);
      myUtxo.push(utxo)
    } catch (e) {
      // do nothing, we are trying to decrypt an utxo which is not owned by the sender
    }    
  })

  // 4) create the nullifier and if it was not spent yet consider it as an unspent utxo
  let unspentUtxo: BaseUtxo[] = []

  myUtxo.forEach(utxo => {
    const nullifier = utxo.getNullifier();
    const isSpent = eventsNullifiers.some(event => toFixedHex(event.args[0]) === toFixedHex(nullifier));
    if (!isSpent) {
      unspentUtxo.push(utxo);
    }
  })

  return { unspentUtxo }
}

export async function getAccountAddress(account: string){
  const contract = await hre.ethers.getContractAt("PoolUsers", contractAddress);
  const filter = contract.filters.PublicKey();
  const events = await contract.queryFilter(filter);
  let publicKey = undefined;
  events.forEach((event) => {
    const owner = event.args[0];
    if(owner.toLowerCase() === account.toLowerCase()){ 
      publicKey = event.args[1]; 
    }
  });
  return publicKey;
}

export async function getAccountKeyPair(username: string, addressSender: string): Promise<Keypair | undefined>{

  const poolAddress = getAccountAddress(addressSender);

  if (!poolAddress) {
    return undefined
  }

  let keyPair: Keypair = getKeyPairByUserId(getID(username)) as Keypair;

  return keyPair;
  
}

export async function getUserAccountInfo(username: string, addressSender: string, {amount}: {amount: any}){
  const senderKeyPair_ = await getAccountKeyPair(username, addressSender);
  const senderKeyPair = senderKeyPair_ ? new Keypair(senderKeyPair_.privkey) : undefined;

  if (senderKeyPair) {
    const { unspentUtxo } = await getUtxoFromKeypair(senderKeyPair, addressSender);
    const result = [];
    let requiredAmount = BigInt(0);
    for (const utxo of unspentUtxo) {
      if (requiredAmount < (amount) && result.length < 16) {
        requiredAmount = requiredAmount + (utxo.amount)
        result.push(utxo)
      } else if (
        requiredAmount >= (amount) &&
        result.length > 2 &&
        result.length < 16
      ) {
        requiredAmount = requiredAmount + (utxo.amount)
        result.push(utxo)
      } else {
        break
      }
    }

    if (unspentUtxo.length !== result.length && result.length === 16 && requiredAmount < (amount)) {
      const utxo = unspentUtxo.slice(0, 16 * 2 - 1)

      // @ts-expect-error
      const availableBalanceAfterMerge = utxo.reduce((acc, curr) => acc.add(curr.amount), BigInt(0))

      throw new Error(
        `Insufficient inputs`,
      )
    }

    return {
      senderKeyPair,
      unspentUtxo: result,
      totalAmount: requiredAmount,
    }
  }
  else {
    throw new Error(`Sender not found`)
  }

}

export async function getTotalAmount(username: string, addressSender: string): Promise<BigInt> {
  const senderKeyPair_ = await getAccountKeyPair(username, addressSender);
  const senderKeyPair = senderKeyPair_ ? new Keypair(senderKeyPair_.privkey) : undefined;
  if (senderKeyPair) {
    const { unspentUtxo } = await getUtxoFromKeypair(senderKeyPair, addressSender);
    let totalAmount = BigInt(0);
    unspentUtxo.forEach(utxo => {
      totalAmount = totalAmount + (utxo.amount)
    })
    return totalAmount;
  }
  else {
    throw new Error(`Sender not found`)
  }

}

function buildMerkleTree({ events }: { events: CommitmentEvents }): typeof MerkleTree {
  const leaves = events.sort((a, b) => a.index - b.index).map((e) => toFixedHex(e.commitment))
  return new MerkleTree(MERKLE_TREE_HEIGHT, leaves, { hashFunction: poseidonHash2 })
}

async function prepareTransaction({
  events = [],
  inputs = [],
  rootHex = '',
  outputs = [],
  recipient = BigInt(0),
}: PrepareTxParams) {
  if (inputs.length > 16 || outputs.length > 2) {
      throw new Error('Incorrect inputs/outputs count')
  }
  while (inputs.length !== 2 && inputs.length < 16) {
      inputs.push(new Utxo())
  }
  while (outputs.length < 2) {
      outputs.push(new Utxo())
  }
  
  // output - input
  let extAmount = outputs.reduce((sum, x) => sum + x.amount, BigInt(0)) - inputs.reduce((sum, x) => sum + x.amount, BigInt(0));

  const amount = extAmount > (0) ? extAmount : BigInt(0)

  let params = {
      inputs,
      outputs,
      extAmount,
      tree: rootHex,
      recipient
  }

  if (!rootHex) {
      params.tree = await buildMerkleTree({ events })
  }

  const { extData, args } = await getProof(params)

  return {
      extData,
      args,
      amount,
  }

}

async function fetchCommitments(): Promise<CommitmentEvents>{
  const contract = await hre.ethers.getContractAt("UTXOsPool", UTXOS_POOL_ADDRESS);
  const filter = contract.filters.NewCommitment();
  const events = await contract.queryFilter(filter);
  const commitments: CommitmentEvents = [];
  events.forEach((event) => {
    commitments.push({
      blockNumber: event.blockNumber,
      transactionHash: event.transactionHash,
      commitment: event.args[0],
      index: Number(event.args[1]),
      encryptedOutput: event.args[2]
    })
  });
  return commitments
}

export async function createTransactionData(params: CreateTransactionParams, keypair: Keypair, signer: any){
  if (!params.inputs || !params.inputs.length) {
    const contract = await hre.ethers.getContractAt("UTXOsPool", UTXOS_POOL_ADDRESS, signer);
    const root = await contract.getLastRoot();

    params.events = []
    params.rootHex = toFixedHex(root)
  } else {

    params.events = await fetchCommitments()
  }
  const { extData, args, amount } = await prepareTransaction(params)
  return { extData, args, amount }
}