import { ArgsProof, BaseUtxo, Params, ProofParams } from "../pool/types";
import { BytesLike } from '@ethersproject/bytes'
import fs from 'fs';
import path from 'path';
import  { prove } from "../proof/prover";
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

function getExtDataHash({ recipient, extAmount, encryptedOutput1, encryptedOutput2 }: Params) {
    const abi = new hre.ethers.AbiCoder()
  
    const encodedData = abi.encode(
      [
        'tuple(address recipient,int256 extAmount,bytes encryptedOutput1,bytes encryptedOutput2)',
      ],
      [
        {
          recipient: toFixedHex(recipient, ADDRESS_BYTES_LENGTH),
          extAmount: extAmount,
          encryptedOutput1: encryptedOutput1,
          encryptedOutput2: encryptedOutput2,
        },
      ]
    )
    const hash = hre.ethers.keccak256(encodedData)
    return BigInt(hash) % FIELD_SIZE;
  }

// to be moved to the proof folder
export async function getProof({ inputs, outputs, tree, extAmount, recipient }: ProofParams) {
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
    }
    
    const extDataHash = getExtDataHash(extData) // for integrity check of extData in the contract: extDataHash will be compared with the hash calculated contract side
  
    const input = {
      root: typeof tree === 'string' ? tree : tree.root(),
      inputNullifier: inputs.map((x) => x.getNullifier()),
      outputCommitment: outputs.map((x) => x.getCommitment()),
      publicAmount : ((extAmount + FIELD_SIZE) % FIELD_SIZE).toString(), // this is to manage negative numbers
  
      // data for transaction inputs, 2 or 16 inputs
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