import hre from "hardhat";
import fs from 'fs';
import path from 'path';

import { ArgsProof, ArgsSMT, BaseUtxo, Chainstate, Params, ProofParams } from "../pool/types";
import { BytesLike } from '@ethersproject/bytes'
import { createBitArray, computeBloomIndices } from "../utils/bloomUtils";
import { getIdAndMaskedCommitmentByDepositorAddress, insertMaskedCommitment } from "../../database/database";
import { poseidonHash } from "../utils/hashFunctions";
import  { prove } from "./prover";
import { randomBN } from "../pool/utxo";
import { toBuffer } from "../pool/utxo";
import { toFixedHex } from "../utils/toHex";

const ADDRESS_BYTES_LENGTH = 20
const FIELD_SIZE = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617')
const FILTER_SIZE = 16384;
const MERKLE_TREE_HEIGHT = 20;
const SMT_HEIGHT = 20;

function padSiblings(siblings: bigint[], height: number): bigint[] {
  return siblings.length < height
      ? siblings.concat(Array(height - siblings.length).fill(0n))
      : siblings;
}

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
export async function getProof({ inputs, outputs, tree, smt, extAmount, recipient, address }: ProofParams) {
  inputs = shuffle(inputs)
  outputs = shuffle(outputs)

  const inputMerklePathIndices = [] 
  const inputMerklePathElements = [] // array of arrays, each array is a merkle branch

  // const statusToEncrypt: Chainstate[] = []
  const statusMerged: Chainstate = { chainstateBitArray: [] }; // will have always the same size
  
  for (const input of inputs) {
    if (input.amount > 0) {
      input.index = tree.indexOf(toFixedHex(input.getCommitment())) // from the tree we get the index of the commitment

      // for (const chainState of input.chainStates as ChainStates) {

        // here is the case there are multiple utxo from Alice's deposits, each one will have the same masked commitment (the one of the first deposit)
        // if (!statusToEncrypt.includes({index: chainState.index, maskedCommitment: chainState.maskedCommitment})) {
        //   statusToEncrypt.push({index: chainState.index, maskedCommitment: chainState.maskedCommitment});
        // }
      // }

      statusMerged.chainstateBitArray = statusMerged.chainstateBitArray.map((bit, i) => bit | input.chainState!.chainstateBitArray[i]);

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

  // let jsonString = JSON.stringify(statusToEncrypt);
  // let byteSize = new TextEncoder().encode(jsonString).length;
  // console.log(`Size of the statusToEncrypt before encryption: ${byteSize} bytes`);
  
  const [output1, output2] = outputs

  // prepare encrypted chain state

  // let encryptedChainState1, encryptedChainState2; // maybe encryption is not needed, already hashed
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
        const indices = await computeBloomIndices(masked_commitment_one, FILTER_SIZE);
        const chainstateBitArray = createBitArray(FILTER_SIZE, indices);
        const index = insertMaskedCommitment(address as string, commitment_output_one.toString(), blinding_output_one.toString(), toFixedHex(masked_commitment_one));

        const chainState: Chainstate = { chainstateBitArray: chainstateBitArray };
        const bytes = Buffer.concat([Buffer.from(chainState.chainstateBitArray)]); 
        encryptedChainState1 = outputs[0].keypair.encrypt(bytes);
        encryptedChainState2 = encryptedChainState1;  
        
        // console.log("Size of chainState , deposit, before encryption:", bytes.length);
      }

      else {
        const commitment_output_two = outputs[1].getCommitment();
        const blinding_output_two = randomBN();
        const masked_commitment_two = poseidonHash([commitment_output_two, blinding_output_two]);
        const indices = await computeBloomIndices(masked_commitment_two, FILTER_SIZE);
        const chainstateBitArray = createBitArray(FILTER_SIZE, indices);
        const index = insertMaskedCommitment(address as string, commitment_output_two.toString(), blinding_output_two.toString(), toFixedHex(masked_commitment_two));
        
        const chainState: Chainstate = { chainstateBitArray: chainstateBitArray };
        const bytes2 = Buffer.concat([Buffer.from(chainState.chainstateBitArray)]); 
        encryptedChainState2 = outputs[1].keypair.encrypt(bytes2);
        encryptedChainState1 = encryptedChainState2;  
        
        // console.log("Size of chainState , deposit, before encryption:", bytes2.length);
      }

      // console.log("Size of encryptedChainState1, transfer, after encryption:", (encryptedChainState1.length-2)/2);
      // console.log("Size of encryptedChainState2, transfer, after encryption:", (encryptedChainState2.length-2)/2);

    }

    else { // use the first masked commitment also for other deposits

      // @ts-ignore
      const masked_commitment = tuple.maskedCommitment;
      const indices = await computeBloomIndices(masked_commitment, FILTER_SIZE);
      const chainstateBitArray = createBitArray(FILTER_SIZE, indices);

      // @ts-ignore
      const chainState: Chainstate = { chainstateBitArray: chainstateBitArray };

      const bytes = Buffer.concat([Buffer.from(chainState.chainstateBitArray)]); 

      if (outputs[0].amount === extAmount) { 
        encryptedChainState1 = outputs[0].keypair.encrypt(bytes);
        encryptedChainState2 = encryptedChainState1;
      } else {
        encryptedChainState2 = outputs[1].keypair.encrypt(bytes);
        encryptedChainState1 = encryptedChainState2;
      }

      // console.log("Size of encryptedChainState1, transfer, after encryption:", (encryptedChainState1.length-2)/2);
      // console.log("Size of encryptedChainState2, transfer, after encryption:", (encryptedChainState2.length-2)/2);

    }

  }

  else { // meaning that the transaction is a transfer or a withdrawal
    // const buffers = statusToEncrypt.flatMap((x) => [toBuffer(x.index, 31), toBuffer(x.maskedCommitment, 32)]);
    // const bytes = Buffer.concat(buffers);
    const bytes = Buffer.concat([Buffer.from(statusMerged.chainstateBitArray)]); 

    // console.log("Size of chainState, transfer, before encryption:", bytes.length);
    encryptedChainState1 = outputs[0].keypair.encrypt(bytes);
    encryptedChainState2 = outputs[1].keypair.encrypt(bytes);
    // console.log("Size of encryptedChainState1, transfer, after encryption:", (chainState1.length-2)/2);
    // console.log("Size of encryptedChainState2, transfer, after encryption:", (chainState2.length-2)/2);
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
  const { proof, publicSignals } = await prove(input, wasmBuffer, zKeyBuffer)

  const args: ArgsProof = {
    proof,
    root: toFixedHex(input.root),
    inputNullifiers: inputs.map((x) => toFixedHex(x.getNullifier())),
    outputCommitments: outputs.map((x) => toFixedHex(x.getCommitment())) as [BytesLike, BytesLike],
    publicAmount: toFixedHex(input.publicAmount),
    extDataHash: toFixedHex(extDataHash),
  }

  // proofs for each masked commitment
  fileName = `non_membership.wasm`;
  filePath = path.join(dirPath, fileName);
  wasmBuffer = fs.readFileSync(filePath);
  
  fileName = `non_membership.zkey`;
  filePath = path.join(dirPath, fileName);
  zKeyBuffer = fs.readFileSync(filePath);

  const proofs = []

  let totalTime = 0;
  for (const status of statusToEncrypt) {
    const proof_ = smt.createProof(status.index)
    proof_.siblings = padSiblings(proof_.siblings, SMT_HEIGHT)

    const input = {
      root: smt.root,
      siblings: proof_.siblings,
      key: status.index,
      value: 0,
      auxKey: 0,
      auxValue: 0,
      auxIsEmpty: 1,
      isExclusion: 1
    }

    const originalLog = console.log;

    try {
      // console.log = function (...args) {
      //     if (args[0] !== "ERROR:") return;
      // };

      const start = performance.now();
      // @ts-ignore
      const { proof, publicSignals } = await prove(input, wasmBuffer, zKeyBuffer);
      const end = performance.now();
      const time = end - start;
      console.log(`Time to generate proof: ${time} ms`);
      totalTime += time;

      proofs.push(proof);
    } catch (error) {
        throw (`\nError in the transaction preparation: you are trying to include a tainted UTXO!\nMasked commitment: ${toFixedHex(status.maskedCommitment)}\n`);
    } finally {
        console.log = originalLog;
    }
  
  }

  console.log(`Total time to generate all proofs: ${totalTime} ms`);

  const argsSMT: ArgsSMT = {
    proofs,
    root: toFixedHex(smt.root),
  }

  return {
    extData,
    proof,
    args,
    argsSMT,
  }

}

export async function getProofOnboarding({ inputs, outputs, tree, smt, extAmount, recipient, addressSender}: ProofParams) {
  inputs = shuffle(inputs)
  outputs = shuffle(outputs)

  const inputMerklePathIndices = []
  const inputMerklePathElements = []

  // const statusToEncrypt: Chainstate[] = []
  const statusMerged: Chainstate = { chainstateBitArray: [] }; 
  
  for (const input of inputs) {
    if (input.amount > 0) {
      input.index = tree.indexOf(toFixedHex(input.getCommitment())) // from the tree we get the index of the commitment

      // for (const chainState of input.chainStates as ChainStates) {

      //   // here is the case there are multiple utxo from Alice's deposits, each one will have the same masked commitment (the one of the first deposit)
      //   if (!statusToEncrypt.includes({index: chainState.index, maskedCommitment: chainState.maskedCommitment})) {
      //     statusToEncrypt.push({index: chainState.index, maskedCommitment: chainState.maskedCommitment});
      //   }
      // }

      statusMerged.chainstateBitArray = statusMerged.chainstateBitArray.map((bit, i) => bit | input.chainState!.chainstateBitArray[i]);

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

    const tuple = getIdAndMaskedCommitmentByDepositorAddress(addressSender as string);

    if (!tuple) { // first deposit by Alice

      // we create the masked commitment for the one which has the same amount as the deposit, the other is the fictitious output with amount 0
      // this just for deposit case

      if (outputs[0].amount === extAmount) { 
        const commitment_output_one = outputs[0].getCommitment();
        const blinding_output_one = randomBN();
        const masked_commitment_one = poseidonHash([commitment_output_one, blinding_output_one]);
        const indices = await computeBloomIndices(masked_commitment_one, FILTER_SIZE);
        const chainstateBitArray = createBitArray(FILTER_SIZE, indices);
        const index = insertMaskedCommitment(addressSender as string, commitment_output_one.toString(), blinding_output_one.toString(), toFixedHex(masked_commitment_one));

        const chainState: Chainstate = { chainstateBitArray: chainstateBitArray };
        const bytes = Buffer.concat([Buffer.from(chainState.chainstateBitArray)]); 
        encryptedChainState1 = outputs[0].keypair.encrypt(bytes);
        encryptedChainState2 = encryptedChainState1;  
        
        // console.log("Size of chainState , deposit, before encryption:", bytes.length);
      }

      else {
        const commitment_output_two = outputs[1].getCommitment();
        const blinding_output_two = randomBN();
        const masked_commitment_two = poseidonHash([commitment_output_two, blinding_output_two]);
        const indices = await computeBloomIndices(masked_commitment_two, FILTER_SIZE);
        const chainstateBitArray = createBitArray(FILTER_SIZE, indices);
        const index = insertMaskedCommitment(addressSender as string, commitment_output_two.toString(), blinding_output_two.toString(), toFixedHex(masked_commitment_two));
        
        const chainState: Chainstate = { chainstateBitArray: chainstateBitArray };
        const bytes2 = Buffer.concat([Buffer.from(chainState.chainstateBitArray)]); 
        encryptedChainState2 = outputs[1].keypair.encrypt(bytes2);
        encryptedChainState1 = encryptedChainState2;  
      }

    }

    else { // use the first masked commitment also for other deposits

      // @ts-ignore
      const masked_commitment = tuple.maskedCommitment;
      const indices = await computeBloomIndices(masked_commitment, FILTER_SIZE);
      const chainstateBitArray = createBitArray(FILTER_SIZE, indices);

      // @ts-ignore
      const chainState: Chainstate = { chainstateBitArray: chainstateBitArray };

      const bytes = Buffer.concat([Buffer.from(chainState.chainstateBitArray)]); 

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
    const bytes = Buffer.concat([Buffer.from(statusMerged.chainstateBitArray)]); 

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
    publicAmount : ((extAmount + FIELD_SIZE) % FIELD_SIZE).toString(), // this is to manage negative numbers
    extDataHash,

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
  const { proof, publicInput } = await prove(input, wasmBuffer, zKeyBuffer)

  const args: ArgsProof = {
    proof,
    root: toFixedHex(input.root),
    inputNullifiers: inputs.map((x) => toFixedHex(x.getNullifier())),
    outputCommitments: outputs.map((x) => toFixedHex(x.getCommitment())) as [BytesLike, BytesLike],
    publicAmount: toFixedHex(input.publicAmount),
    extDataHash: toFixedHex(extDataHash),
  }

  // proofs for each masked commitment
  fileName = `non_membership.wasm`;
  filePath = path.join(dirPath, fileName);
  wasmBuffer = fs.readFileSync(filePath);
  
  fileName = `non_membership.zkey`;
  filePath = path.join(dirPath, fileName);
  zKeyBuffer = fs.readFileSync(filePath);

  const proofs: BytesLike[] = []
  for (const status of statusToEncrypt) {
    const proof_ = smt.createProof(status.index)
    proof_.siblings = padSiblings(proof_.siblings, SMT_HEIGHT)

    const input = {
      root: smt.root,
      siblings: proof_.siblings,
      key: status.index,
      value: 0,
      auxKey: 0,
      auxValue: 0,
      auxIsEmpty: 1,
      isExclusion: 1
    }

    try {
      const start = performance.now();
      // @ts-ignore
      const { proof, publicSignals } = await prove(input, wasmBuffer, zKeyBuffer)
      const end = performance.now();
      const time = end - start;
      console.log(`Time to generate proof: ${time} ms`);
      proofs.push(proof)
    }
    catch (e) {
      throw (`\nYou are trying to include a tainted UTXO!\nMasked commtiment: ${toFixedHex(status.maskedCommitment)}\n`);
    }
        
  }

  const argsSMT: ArgsSMT = {
    proofs: proofs,
    root: toFixedHex(smt.root),
  }

  return {
    extData,
    proof,
    args,
    argsSMT,
  }
}