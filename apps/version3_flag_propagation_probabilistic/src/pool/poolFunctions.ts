import { BaseUtxo, Chainstate, ChainStates, CreateTransactionParams, CommitmentEvents, PrepareTxParams, StatusTreeEvents } from "./types";
import { getKeyPairByUserId, getKeyPairOnboardingByUserId, getID } from "../../database/database";
import { getProof, getProofOnboarding } from "../proof/generateTransactionProof";
import hre from "hardhat";
import { Keypair } from "./keypair";
// @ts-ignore
import MerkleTree from 'fixed-merkle-tree';
import { poseidonHash, poseidonHash2 } from "../utils/hashFunctions";
import { SMT } from "@zk-kit/smt";
import { toFixedHex } from "../utils/toHex";
import { Utxo } from "./utxo";

const contractAddress = process.env.POOL_USERS_ADDRESS || '';
const MERKLE_TREE_HEIGHT = 20;
const MIXER_ONBOARDING_AND_TRANSFERS_V3 = process.env.MIXER_ONBOARDING_AND_TRANSFERS_V3 || '';

export async function getUtxoFromKeypair(senderKeyPair: Keypair, addressSender: string){

  const chainStateSize = 63;

  // 1) fetch all nullifiers
  const contract = await hre.ethers.getContractAt("contracts/src/FlagPropagation/MixerOnboardingAndTransfersV3.sol:MixerOnboardingAndTransfers", MIXER_ONBOARDING_AND_TRANSFERS_V3);
  let filter = contract.filters.NewNullifier();
  const eventsNullifiers = await contract.queryFilter(filter);

  // 2) fetch all commitment events
  filter = contract.filters.NewCommitmentV2();
  const eventsCommitments = await contract.queryFilter(filter);

  // 3) for each event, take the encrypted output field, decrypt it and if it's owned by the sender, add it to the myUtxo array
  let myUtxo: BaseUtxo[] = []

  eventsCommitments.forEach(event => {
    const index = Number(event.args[1])
    const encryptedOutput = event.args[2]
    try {
      const utxo = Utxo.decrypt(senderKeyPair, encryptedOutput, index);
      const buf = senderKeyPair.decrypt(event.args[3]) 
      const chainStates : Chainstate[] = []

      for (let i = 0; i < buf.length; i += chainStateSize) {
        const index = BigInt('0x' + buf.slice(i, i + 31).toString('hex'));
        const maskedCommitment = BigInt('0x' + buf.slice(i + 31, i+chainStateSize).toString('hex'));
        // console.log("Index:", buf.slice(i, i + 31).toString('hex'))
        // console.log("Masked:", '0x'+buf.slice(i + 31, chainStateSize).toString('hex'))
        const chainState: Chainstate = { index, maskedCommitment: maskedCommitment }
        chainStates.push(chainState)
      }

      utxo.chainStates = chainStates
      myUtxo.push(utxo)

      // console.log(myUtxo)

    } catch (e) {
      // console.log(e)
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

export async function getOnbUtxoFromKeypair(senderKeyPair: Keypair, addressSender: string){ 

  const chainStateSize = 63; 
  const chainStates : Chainstate[] = []

  // 1) fetch all nullifiers
  const contract = await hre.ethers.getContractAt("contracts/src/FlagPropagation/MixerOnboardingAndTransfersV3.sol:MixerOnboardingAndTransfers", MIXER_ONBOARDING_AND_TRANSFERS_V3);
  let filter = contract.filters.NewNullifier();
  const eventsNullifiers = await contract.queryFilter(filter);

  // 2) fetch all commitment events
  filter = contract.filters.NewCommitmentV2();
  const eventsCommitments = await contract.queryFilter(filter);

  // 3) for each event, take the encrypted output field, decrypt it and if it's owned by the sender, add it to the myUtxo array
  let myUtxo: BaseUtxo[] = []

  eventsCommitments.forEach(event => {
    const index = Number(event.args[1])
    const encryptedOutput = event.args[2]
    try {
      const utxo = Utxo.decrypt(senderKeyPair, encryptedOutput, index);
      const buf = senderKeyPair.decrypt(event.args[3]) 

      for (let i = 0; i < buf.length; i += chainStateSize) {
        const index = BigInt('0x' + buf.slice(i, i + 31).toString('hex'));
        const maskedCommitment = BigInt('0x' + buf.slice(i + 31, i+chainStateSize).toString('hex'));
        // console.log(buf.slice(i + 31, i + chainStateSize).toString('utf-8'))
        const chainState: Chainstate = { index, maskedCommitment: maskedCommitment }
        chainStates.push(chainState)
      }

      utxo.chainStates = chainStates
      myUtxo.push(utxo)

      // console.log(myUtxo)

    } catch (e) {
      // do nothing, we are trying to decrypt an utxo which is not owned by the sender
    }    

  })

  // 4) create the nullifier and if it was not spent yet consider it as an unspent utxo
  let unspentUtxoOnb: BaseUtxo[] = []

  myUtxo.forEach(utxo => {
    const nullifier = utxo.getNullifier();
    const isSpent = eventsNullifiers.some(event => toFixedHex(event.args[0]) === toFixedHex(nullifier));
    if (!isSpent) {
      unspentUtxoOnb.push(utxo);
    }
  })

  return { unspentUtxoOnb }
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
  
  let key_pair_onb_: Keypair | undefined;

  try {
    key_pair_onb_ = getKeyPairOnboardingByUserId(getID(username)) as Keypair;
  } catch (e) {
    key_pair_onb_ = undefined;
  }
  
  const key_pair_onb = key_pair_onb_ ? new Keypair(key_pair_onb_.privkey) : undefined;

  if (senderKeyPair && key_pair_onb) {
    const { unspentUtxo } = await getUtxoFromKeypair(senderKeyPair, addressSender);
    const { unspentUtxoOnb } = await getOnbUtxoFromKeypair(key_pair_onb, addressSender);
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
    for (const utxo of unspentUtxoOnb) {
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
  else if (senderKeyPair) {
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

async function buildSMTree({ events }: { events: StatusTreeEvents }): Promise<SMT>  /*MerkleTreeIden3*/ {
  const smt = new SMT(poseidonHash, true);
  for (const event of events) {
    smt.add(BigInt(event.index), BigInt(event.maskedCommitment))
  }
  // console.log("Root: ", smt.root)

  // console.log(`Proof for 3: `, smt.createProof(BigInt(3)))
  
  return smt;
  
  // const localStorage = new LocalStorageDB(str2Bytes(''));
  // const inMemoryDb = new InMemoryDB(str2Bytes(''));
  // const smt = new MerkleTreeIden3 (inMemoryDb, true, 20);
  // for (const event of events) {
  //   await smt.add(BigInt(event.index), BigInt(event.maskedCommitment))
  // }
  // const root = await smt.root();
  // console.log("Root2: ", BigInt(root.string()))  
  //return smt;
}

async function prepareOnboarding ({
  events = [],
  eventsStatusTree = [],
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

  let extAmount = outputs.reduce((sum, x) => sum + x.amount, BigInt(0)) - inputs.reduce((sum, x) => sum + x.amount, BigInt(0));

  const amount = extAmount > (0) ? extAmount : BigInt(0)

  let params = {
      inputs,
      outputs,
      extAmount,
      tree: rootHex,
      smt: await buildSMTree({ events: eventsStatusTree }),
      recipient
  }

  if (!rootHex) {
    params.tree = await buildMerkleTree({ events })
  }

  const { extData, args, argsSMT } = await getProofOnboarding(params)

  return {
      extData,
      args,
      argsSMT,
      amount,
  }

}

async function prepareTransaction({
  events = [],
  eventsStatusTree = [],
  inputs = [],
  rootHex = '',
  outputs = [],
  recipient = BigInt(0),
  address = '',
}: PrepareTxParams) {
  if (inputs.length > 16 || outputs.length > 2) {
      throw new Error('Incorrect inputs/outputs count')
  }

  // We decide to include a fixed number of 2 or 16 utxos as inputs, reaching these number if necessary with fitticious utxos
  // This is need due to circom behaviour, I cannot create a signal which behaves like a counter or even use something like inputs.length
  // In the proof skip the ones with amount zero
  // For this reason there are two components instansiated with nIns = 2 and nIns = 16

  while (inputs.length !== 2 && inputs.length < 16) {
      inputs.push(new Utxo()) // new input UTXO with amount zero
  }

  // Create always two output, in this way there is no way to tell if a change has necessarily happened
  while (outputs.length < 2) {
      outputs.push(new Utxo()) // new output UTXO with amount zero
  }
  
  // output - input
  let extAmount = outputs.reduce((sum, x) => sum + x.amount, BigInt(0)) - inputs.reduce((sum, x) => sum + x.amount, BigInt(0));

  const amount = extAmount > (0) ? extAmount : BigInt(0)

  let params = {
      inputs,
      outputs,
      extAmount,
      tree: rootHex,
      smt: await buildSMTree({ events: eventsStatusTree }),
      recipient,
      address
  }

  // console.log("\nRoot: ", toFixedHex(params.smt.root.toString()))

  if (!rootHex) { // do not enter here if it's a deposit
      params.tree = await buildMerkleTree({ events }) // build the tree off-chain
  }

  const { extData, args, argsSMT } = await getProof(params)

  return {
      extData,
      args,
      argsSMT,
      amount,
  }

}

async function fetchCommitments(): Promise<CommitmentEvents>{
  const contract = await hre.ethers.getContractAt("contracts/src/FlagPropagation/MixerOnboardingAndTransfersV3.sol:MixerOnboardingAndTransfers", MIXER_ONBOARDING_AND_TRANSFERS_V3);
  const filter = contract.filters.NewCommitmentV2();
  const events = await contract.queryFilter(filter);
  const commitments: CommitmentEvents = [];
  events.forEach((event) => {
    commitments.push({
      blockNumber: event.blockNumber,
      transactionHash: event.transactionHash,
      commitment: event.args[0],
      index: Number(event.args[1]),
      encryptedOutput: event.args[2],
      encryptedChainState: event.args[3]
    })
  });
  return commitments
}

async function fetchStatusTreeEvents(): Promise<StatusTreeEvents> {
  const contract = await hre.ethers.getContractAt("contracts/src/FlagPropagation/MixerOnboardingAndTransfersV3.sol:MixerOnboardingAndTransfers", MIXER_ONBOARDING_AND_TRANSFERS_V3);
  const filter = contract.filters.StatusFlagged();
  const events = await contract.queryFilter(filter);
  const statusTreeEvents: StatusTreeEvents = [];
  events.forEach((event) => {
    statusTreeEvents.push({
      blockNumber: event.blockNumber,
      transactionHash: event.transactionHash,
      index: Number(event.args[0]),
      maskedCommitment: event.args[1]
    })
  });
  return statusTreeEvents
}

export async function createOnboardingData(params: CreateTransactionParams, keypair: Keypair, signer: any, addressSender: string){
  params.events = await fetchCommitments()
  params.eventsStatusTree = await fetchStatusTreeEvents()
  params.addressSender = addressSender
  const { extData, args, argsSMT, amount } = await prepareOnboarding(params)
  return { extData, args, argsSMT, amount }
}

export async function createTransactionData(params: CreateTransactionParams, keypair: Keypair, signer: any, address ?: string){
  if (!params.inputs || !params.inputs.length) { // enter here for the deposit
    const contract = await hre.ethers.getContractAt("contracts/src/FlagPropagation/MixerOnboardingAndTransfersV3.sol:MixerOnboardingAndTransfers", MIXER_ONBOARDING_AND_TRANSFERS_V3, signer);
    const root = await contract.getLastRoot_(); // take the last root, used in prepareTransaction to skip off-chain tree construction

    params.events = []
    params.eventsStatusTree = await fetchStatusTreeEvents()
    params.rootHex = toFixedHex(root)
    params.address = address
  } else {
    params.events = await fetchCommitments()
    params.eventsStatusTree = await fetchStatusTreeEvents()
  }

  const { extData, args, argsSMT, amount } = await prepareTransaction(params)
  return { extData, args, argsSMT, amount }
}