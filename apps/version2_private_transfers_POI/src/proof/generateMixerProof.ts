import { fetchEvents } from "../utils/fetchEvents";
import { toHex } from "../utils/toHex";
import { toBN} from 'web3-utils';
import fs from 'fs';
import path from 'path';
import { prove } from "./prover";
// @ts-ignore
import MerkleTree from 'fixed-merkle-tree';

const MERKLE_TREE_HEIGHT = 20;

async function generateMerkleProof(deposit: any) {
    let leafIndex = -1;
  
    // fetching 'CommitmentCreated' events
    const cachedEvents = await fetchEvents({ type: 'CommitmentCreated'});
  
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

export async function generateMixerProof({ deposit, account}: any) {

    const { root, pathElements, pathIndices } = await generateMerkleProof(deposit);

    let input;

    try {
      input = {
        // Public snark inputs
        root: root,
        nullifierHash: deposit.nullifierHash,
    
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
    
        // Private snark inputs
        nullifier: deposit.nullifier,
        secret: deposit.secret,
        pathElements: pathElements,
        pathIndices: pathIndices
      }
    }  

    console.log('\nGenerating SNARK proof');

    let dirPath = path.join(__dirname, '../../../../circuits/artifacts/circuits/');
    let fileName = `withdraw.wasm`;
    let filePath = path.join(dirPath, fileName);
    let wasmBuffer = fs.readFileSync(filePath);

    fileName = `withdraw.zkey`;
    filePath = path.join(dirPath, fileName);
    let zKeyBuffer = fs.readFileSync(filePath);

    // @ts-ignore
    const proof = await prove(input, wasmBuffer, zKeyBuffer);

    const args = [
      toHex(input.root),
      toHex(input.nullifierHash),
      toHex(account, 20)
    ];

    return { proof, args };
}
