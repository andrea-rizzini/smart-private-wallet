import hre from "hardhat";
import fs from 'fs';
import path from 'path';

import { ArgsProof, BaseUtxo, Params, ProofParams } from "../pool/types";
import { BytesLike } from '@ethersproject/bytes'
import { getIdAndMaskedCommitmentByDepositorAddress, insertMaskedCommitment } from "../../database/database";
import { poseidonHash } from "../utils/hashFunctions";
import  { prove } from "../proof/prover";
import { randomBN } from "../pool/utxo";
import { toBuffer } from "../pool/utxo";
import { toFixedHex } from "../utils/toHex";

const ADDRESS_BYTES_LENGTH = 20
const FIELD_SIZE = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617')
const MERKLE_TREE_HEIGHT = 20;

function shuffle(array: BaseUtxo[]) {
    let currentIndex = array.length
    let randomIndex
  
    while (currentIndex !== 0) {
      randomIndex = Math.floor(Math.random() * currentIndex)
      currentIndex--
  
      ;[array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]]
    }
  
    return array
}

function getExtDataHash({ recipient, extAmount, encryptedOutput1, encryptedOutput2, encryptedChainState1, encryptedChainState2 }: Params) {
    const abi = new hre.ethers.AbiCoder()
  
    const encodedData = abi.encode(
      [
        'tuple(address recipient,int256 extAmount,bytes encryptedOutput1,bytes encryptedOutput2, bytes encryptedChainState1, bytes encryptedChainState2)',
      ],
      [
        {
          recipient: toFixedHex(recipient, ADDRESS_BYTES_LENGTH),
          extAmount: extAmount,
          encryptedOutput1: encryptedOutput1,
          encryptedOutput2: encryptedOutput2,
          encryptedChainState1: encryptedChainState1,
          encryptedChainState2: encryptedChainState2
        },
      ]
    )
    const hash = hre.ethers.keccak256(encodedData)
    return BigInt(hash) % FIELD_SIZE;
  }

// to be moved to the proof folder
export async function getProof({ inputs, outputs, tree, extAmount, recipient, address }: ProofParams) {
    inputs = shuffle(inputs)
    outputs = shuffle(outputs)
  
    const inputMerklePathIndices = [] 
    const inputMerklePathElements = [] // array of arrays, each array is a merkle branch

    const statusToEncrypt: bigint[] = []
    
    for (const input of inputs) {
      if (input.amount > 0) {
        input.index = tree.indexOf(toFixedHex(input.getCommitment())) // from the tree we get the index of the commitment

        // here is the case there are multiple utxo from Alice's deposits, each one has the same masked commitment (the one of the first deposit)
        // if transfer or withdrawal, this if will be skipped since it not enters even the first check
        if (!statusToEncrypt.includes(input.chainState as bigint)) {
          statusToEncrypt.push(input.chainState as bigint);
        }
  
        if (input.index < 0) {
          throw new Error(`Input commitment ${toFixedHex(input.getCommitment())} was not found`)
        }
        inputMerklePathIndices.push(input.index) 
        inputMerklePathElements.push(tree.path(input.index).pathElements)
      } else {
        inputMerklePathIndices.push(0) // merkle indices for fitticious inputs
        inputMerklePathElements.push(new Array(MERKLE_TREE_HEIGHT).fill(0)) // merkle path for fitticious inputs
      }
    }
    
    const [output1, output2] = outputs

    // prepare encrypted chain state

    let encryptedChainState1, encryptedChainState2;

    if (extAmount > 0) { // meaning that the transaction is a deposit

      const tuple = getIdAndMaskedCommitmentByDepositorAddress(address as string);

      if (!tuple) { // first deposit by Alice

        // we create the masked commitment for the one which has the same amount as the deposit, the other is the fictitious output with amount 0
        // this just for deposit case

        if (outputs[0].amount === extAmount) { 
          const commitment_output_one = outputs[0].getCommitment();
          const blinding_output_one = randomBN();
          const masked_commitment_one = poseidonHash([commitment_output_one, blinding_output_one]);
          const bytes = Buffer.concat([toBuffer(masked_commitment_one, 31)]);
          encryptedChainState1 = outputs[0].keypair.encrypt(bytes);
          encryptedChainState2 = encryptedChainState1;
          insertMaskedCommitment(address as string, commitment_output_one.toString(), blinding_output_one.toString(), toFixedHex(masked_commitment_one));
        }
        else {
          const commitment_output_two = outputs[1].getCommitment();
          const blinding_output_two = randomBN();
          const masked_commitment_two = poseidonHash([commitment_output_two, blinding_output_two]);
          const bytes2 = Buffer.concat([toBuffer(masked_commitment_two, 31)]);
          encryptedChainState2 = outputs[1].keypair.encrypt(bytes2);
          encryptedChainState1 = encryptedChainState2;
          insertMaskedCommitment(address as string, commitment_output_two.toString(), blinding_output_two.toString(), toFixedHex(masked_commitment_two));
        }

      }

      else { // use the first masked commitment also for other deposits

        // @ts-ignore
        const index = tuple.id;
        // @ts-ignore
        const masked_commitment = tuple.maskedCommitment;
        
        const bytes = Buffer.concat([toBuffer(masked_commitment, 31)]);

        if (outputs[0].amount === extAmount) { 
          encryptedChainState1 = outputs[0].keypair.encrypt(bytes);
          encryptedChainState2 = encryptedChainState1;
        } else {
          encryptedChainState2 = outputs[1].keypair.encrypt(bytes);
          encryptedChainState1 = encryptedChainState2;
        }
        
      }

    }

    else { // meaning that the transaction is a transfer or a withdrawal
      const buffers = statusToEncrypt.map((x) => toBuffer(x, 31));
      const bytes = Buffer.concat(buffers);
      encryptedChainState1 = outputs[0].keypair.encrypt(bytes);
      encryptedChainState2 = outputs[1].keypair.encrypt(bytes);
    }
    
    // prepare extData
    const extData = {
      recipient: toFixedHex(recipient, ADDRESS_BYTES_LENGTH),
      extAmount: toFixedHex(extAmount),
      encryptedOutput1: output1.encrypt(), // this will be the event onchain, making possible for the receiver to decrypt the output and realize that they are his utxo
      encryptedOutput2: output2.encrypt(),
      encryptedChainState1: encryptedChainState1,
      encryptedChainState2: encryptedChainState2
    }
    
    const extDataHash = getExtDataHash(extData)
  
    const input = {
      root: typeof tree === 'string' ? tree : tree.root(),
      inputNullifier: inputs.map((x) => x.getNullifier()),
      outputCommitment: outputs.map((x) => x.getCommitment()),
      publicAmount : ((extAmount + FIELD_SIZE) % FIELD_SIZE).toString(),
      extDataHash,
  
      // data for transaction inputs
      inAmount: inputs.map((x) => x.amount),
      inPrivateKey: inputs.map((x) => x.keypair.privkey), // it's an array
      inBlinding: inputs.map((x) => x.blinding),
      inPathIndices: inputMerklePathIndices,
      inPathElements: inputMerklePathElements,
  
      // data for transaction outputs
      outAmount: outputs.map((x) => x.amount),
      outBlinding: outputs.map((x) => x.blinding),
      outPubkey: outputs.map((x) => x.keypair.pubkey),
    }
    
    let dirPath = path.join(__dirname, `../../../../circuits/artifacts/circuits/`);
    let fileName = `transaction${inputs.length}.wasm`;
    let filePath = path.join(dirPath, fileName);
    let wasmBuffer = fs.readFileSync(filePath);
    
    fileName = `transaction${inputs.length}.zkey`;
    filePath = path.join(dirPath, fileName);
    let zKeyBuffer = fs.readFileSync(filePath);
    
    // @ts-ignore
    const proof = await prove(input, wasmBuffer, zKeyBuffer)
  
    const args: ArgsProof = {
      proof,
      root: toFixedHex(input.root),
      inputNullifiers: inputs.map((x) => toFixedHex(x.getNullifier())),
      outputCommitments: outputs.map((x) => toFixedHex(x.getCommitment())) as [BytesLike, BytesLike],
      publicAmount: toFixedHex(input.publicAmount),
      extDataHash: toFixedHex(extDataHash),
    }
  
    return {
      extData,
      proof,
      args,
    }
  
}

export async function getProofOnboarding({ inputs, outputs, tree, extAmount, recipient }: ProofParams) {
  inputs = shuffle(inputs)
  outputs = shuffle(outputs)

  const inputMerklePathIndices = []
  const inputMerklePathElements = []
  
  for (const input of inputs) {
    if (input.amount > 0) {
      input.index = tree.indexOf(toFixedHex(input.getCommitment()))

      if (input.index < 0) {
        throw new Error(`Input commitment ${toFixedHex(input.getCommitment())} was not found`)
      }
      inputMerklePathIndices.push(input.index)
      inputMerklePathElements.push(tree.path(input.index).pathElements)
    } else {
      inputMerklePathIndices.push(0)
      inputMerklePathElements.push(new Array(MERKLE_TREE_HEIGHT).fill(0))
    }
  }
  
  const [output1, output2] = outputs 

  const extData = {
    recipient: toFixedHex(recipient, ADDRESS_BYTES_LENGTH),
    extAmount: toFixedHex(extAmount),
    encryptedOutput1: output1.encrypt(),
    encryptedOutput2: output2.encrypt(),
    encryptedChainState1: output1.encrypt(),
    encryptedChainState2: output2.encrypt()
  }
  
  const extDataHash = getExtDataHash(extData)

  const input = {
    root: typeof tree === 'string' ? tree : tree.root(),
    inputNullifier: inputs.map((x) => x.getNullifier()),
    outputCommitment: outputs.map((x) => x.getCommitment()),
    publicAmount : ((extAmount + FIELD_SIZE) % FIELD_SIZE).toString(), // this is to manage negative numbers

    // data for transaction inputs
    inAmount: inputs.map((x) => x.amount),
    inPrivateKey: inputs.map((x) => x.keypair.privkey), // it's an array
    inBlinding: inputs.map((x) => x.blinding),
    inPathIndices: inputMerklePathIndices,
    inPathElements: inputMerklePathElements,

    // data for 2 transaction outputs
    outAmount: outputs.map((x) => x.amount),
    outBlinding: outputs.map((x) => x.blinding),
    outPubkey: outputs.map((x) => x.keypair.pubkey),
  }
  
  let dirPath = path.join(__dirname, `../../../../circuits/artifacts/circuits/`);
  let fileName = `transaction${inputs.length}.wasm`;
  let filePath = path.join(dirPath, fileName);
  let wasmBuffer = fs.readFileSync(filePath);
  
  fileName = `transaction${inputs.length}.zkey`;
  filePath = path.join(dirPath, fileName);
  let zKeyBuffer = fs.readFileSync(filePath);
  
  // @ts-ignore
  const proof = await prove(input, wasmBuffer, zKeyBuffer)

  const args: ArgsProof = {
    proof,
    root: toFixedHex(input.root),
    inputNullifiers: inputs.map((x) => toFixedHex(x.getNullifier())),
    outputCommitments: outputs.map((x) => toFixedHex(x.getCommitment())) as [BytesLike, BytesLike],
    publicAmount: toFixedHex(input.publicAmount),
    extDataHash: toFixedHex(extDataHash),
  }

  return {
    extData,
    proof,
    args,
  }
}