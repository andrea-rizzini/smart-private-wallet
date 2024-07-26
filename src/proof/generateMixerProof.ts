import { fetchEvents } from "../utils/fetchEvents";
import { toHex } from "../utils/toHex";
import { toBN} from 'web3-utils';
import fs from 'fs';
import path from 'path';
// @ts-ignore
import MerkleTree from 'fixed-merkle-tree';
// @ts-ignore
import * as snarkjs from 'snarkjs';
// @ts-ignore
import build from 'websnark/src/groth16';
// @ts-ignore
import * as websnarkUtils from 'websnark/src/utils';
const bigInt = snarkjs.bigInt;

const MERKLE_TREE_HEIGHT = 20;

async function generateMerkleProof(deposit: any, currency: string, amount: number) {
    let leafIndex = -1;
  
    // fetching 'CommitmentCreated' events
    const cachedEvents = await fetchEvents({ type: 'CommitmentCreated', currency, amount });
  
    // prepare the leaves for the merkle tree
    const leaves = cachedEvents
      .sort((a: any, b: any) => a.leafIndex - b.leafIndex) // Sort events in chronological order
      .map((e: any) => {
        const index = toBN(e.leafIndex).toNumber();
  
        if (toBN(e.commitment).eq(toBN(deposit.commitmentHex))) {
          leafIndex = index;
        }
        return toBN(e.commitment).toString(10);
      });
  
    // build the merkle tree  
    const tree = new MerkleTree(MERKLE_TREE_HEIGHT, leaves);
  
    // validate that our data is correct
    const root = tree.root();
  
    // Compute merkle proof of our commitment
    const { pathElements, pathIndices } = tree.path(leafIndex);
    return { root, pathElements, pathIndices };
}

export async function generateMixerProof({ deposit, currency, amount, account, relayer= 0, fee = 0, refund = 0 }: any) {

    const { root, pathElements, pathIndices } = await generateMerkleProof(deposit, currency, amount);

    let input;

    try {
      input = {
        // Public snark inputs
        root: root,
        nullifierHash: deposit.nullifierHash,
        recipient: bigInt(account),
        relayer: bigInt(relayer.address),
        fee: bigInt(fee),
        refund: bigInt(refund),
    
        // Private snark inputs
        nullifier: deposit.nullifier,
        secret: deposit.secret,
        pathElements: pathElements,
        pathIndices: pathIndices
      }
    } catch (error) {
      input = {
        // Public snark inputs
        root: root,
        nullifierHash: deposit.nullifierHash,
        recipient: bigInt(account),
        relayer: bigInt(relayer),
        fee: bigInt(fee),
        refund: bigInt(refund),
    
        // Private snark inputs
        nullifier: deposit.nullifier,
        secret: deposit.secret,
        pathElements: pathElements,
        pathIndices: pathIndices
      }
    }  

    console.log('\nGenerating SNARK proof');
    let groth16 = await build();

    const dirPath = path.join(__dirname, '../../circuits/v1_onboarding/');
    let fileName = `withdraw.json`;
    let filePath = path.join(dirPath, fileName);
    const circuit = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    fileName = `proving_key.bin`;
    filePath = path.join(dirPath, fileName);
    const proving_key = fs.readFileSync(filePath);
    const proving_key_arrayBuffer = proving_key.buffer.slice(proving_key.byteOffset, proving_key.byteOffset + proving_key.byteLength);

    const proofData = await websnarkUtils.genWitnessAndProve(groth16, input, circuit, proving_key_arrayBuffer);
    const { proof } = websnarkUtils.toSolidityInput(proofData);

    const args = [
      toHex(input.root),
      toHex(input.nullifierHash),
      toHex(input.recipient, 20),
      toHex(input.relayer, 20),
      toHex(input.fee),
      toHex(input.refund)
    ];

    return { proof, args };
}
