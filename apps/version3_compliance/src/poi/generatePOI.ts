import fs from 'fs';
import path from 'path';

import { ArgsPOI } from '../pool/types';
import { buildMerkleTree } from "../pool/poolFunctions";
import { checkSanctionedAddress } from "./checkIfSanctioned";
import { CommitmentEvent, CommitmentEvents } from "../pool/types";
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

export async function generatePOI(params: GeneratePOIParams, n: number = 10) { // n is the cardinality of the assosiaction set

    const inputs = params.inputs;
    const events_mixer = params.events_mixer;
    const events_association_set = params.events_association_set;

    let events_: CommitmentEvents = []; // this is the array of events that will be used to build the POI, then also published on-chain

    // we take events associated to the user
    const userEvent: CommitmentEvents = [];
    for (const input of inputs) {
   
        const event: CommitmentEvent = events_mixer.find(event_mixer => event_mixer.commitment === toFixedHex(input.commitment)) as CommitmentEvent;
        
        if (event) {
            userEvent.push(event); 
        }

    }

    // we take all the events which are also in the association set
    for (const event of events_mixer) {
        const association = events_association_set.find(association => association.commitment === event.commitment);
        if (association) {
            events_.push(event);
        }
    }    

    // check if user events are inside events_, if so remove them from events_
    for (const user of userEvent) {
        const index = events_.findIndex(event => event.commitment === user.commitment);
        if (index > -1) {
            events_.splice(index, 1);
        }
    }

    // take just n-2 events from the association set
    events_ = shuffleEvents(events_);
    events_ = events_.slice(0, n-2);

    // add user events
    events_ = events_.concat(userEvent);
    events_ = shuffleEvents(events_);

    // console.log(events_);

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
        inputNullifiers: inputs.map((x) => x.getNullifier()),
    
        inAmount: inputs.map((x) => x.amount),
        inPrivateKey: inputs.map((x) => x.keypair.privkey), 
        inBlinding: inputs.map((x) => x.blinding),
        inPathIndices: inputMerklePathIndices,
        inPathElements: inputMerklePathElements,
    }

    let dirPath = path.join(__dirname, `../../../../circuits/artifacts/circuits/`);
    let fileName = `poi${inputs.length}.wasm`;
    let filePath = path.join(dirPath, fileName);
    let wasmBuffer = fs.readFileSync(filePath);
    
    fileName = `poi${inputs.length}.zkey`;
    filePath = path.join(dirPath, fileName);
    let zKeyBuffer = fs.readFileSync(filePath);

    // @ts-ignore
    const proof = await prove(input, wasmBuffer, zKeyBuffer)

    const argsPOI: ArgsPOI = {
        proof,
        root: toFixedHex(input.root),
        inputNullifiers: inputs.map((x) => toFixedHex(x.getNullifier())),
        commitments: events_.map((x) => toFixedHex(x.commitment))
    }

    return argsPOI;

}