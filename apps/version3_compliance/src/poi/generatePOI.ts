import fs from 'fs';
import path from 'path';

import { ArgsPOI } from '../pool/types';
import { buildMerkleTree } from "../pool/poolFunctions";
import { checkSanctionedAddress } from "./checkIfSanctioned";
import { CommitmentEvents } from "../pool/types";
import { toFixedHex } from "../utils/toHex";
import { GeneratePOIParams } from "../pool/types";
import  { prove } from "../proof/prover";

const MERKLE_TREE_HEIGHT = 20;
const RELAYER_ADDRESS = process.env.RELAYER_ADDRESS || '';

export function shuffleEvents(array: CommitmentEvents) { 
    let currentIndex = array.length
    let randomIndex
  
    while (currentIndex !== 0) {
      randomIndex = Math.floor(Math.random() * currentIndex)
      currentIndex--
  
      ;[array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]]
    }
  
    return array
}

export async function generatePOI(params: GeneratePOIParams, n: number = 10) { // n is the number of events to include in the merkle tree
    
    // first check if the sender is sanctioned, it may be that the sender address has become sanctioned in the meantime
    // if that is the case, he can't generate a valid POI
    // if that is not the case, we can include him utxos to build the POI
    const { sanction, message } = await checkSanctionedAddress(params.senderAddress, 2);
    
    if (sanction) {
        console.log(`\n${message}`);
        return null;
    }

    const inputs = params.inputs;
    const events = params.events;

    let events_: CommitmentEvents = []; // this will be the array of events that will be used to build the POI

    // here we add events only associated to deposits and with a not sanctioned address
    for (const event of events) {
        const transactionHash = event.transactionHash;
        const receipt = await hre.ethers.provider.getTransactionReceipt(transactionHash);
        receipt.logs.forEach((log: any, index: number) => {
            if (index === 5 && log.topics.length === 4) { // length 4 means it's a deposit event
                const address = '0x' + log.topics[2].slice(26)
                if (address !== RELAYER_ADDRESS && address !== params.senderAddress) {
                    events_.push(event);
                }         
            }
        })
    }

    // shuffle and take first n events
    events_ = shuffleEvents(events_).slice(0, n);

    // here we add events associated with user's input utxos
    for (const input of inputs) {
        //if (input.amount > 0) {
            const event = events.find(event => event.commitment === toFixedHex(input.commitment));
            
            if (event) {
                events_.push(event); 
            }
        //}
    }

    // reshuffle after adding input utxos
    events_ = shuffleEvents(events_);

    const tree = await buildMerkleTree({ events: events_ });

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

    const input = {
        root: typeof tree === 'string' ? tree : tree.root(),
        inputNullifier: inputs.map((x) => x.getNullifier()),
    
        inAmount: inputs.map((x) => x.amount),
        inPrivateKey: inputs.map((x) => x.keypair.privkey), 
        inBlinding: inputs.map((x) => x.blinding),
        inPathIndices: inputMerklePathIndices,
        inPathElements: inputMerklePathElements,
    }

    let dirPath = path.join(__dirname, `../../../../circuits/artifacts/circuits/`);
    let fileName = `compliance${inputs.length}.wasm`;
    let filePath = path.join(dirPath, fileName);
    let wasmBuffer = fs.readFileSync(filePath);
    
    fileName = `compliance${inputs.length}.zkey`;
    filePath = path.join(dirPath, fileName);
    let zKeyBuffer = fs.readFileSync(filePath);

    // @ts-ignore
    const proof = await prove(input, wasmBuffer, zKeyBuffer)

    const args: ArgsPOI = {
        proof,
        root: toFixedHex(input.root),
        inputNullifiers: inputs.map((x) => toFixedHex(x.getNullifier()))
    }

}