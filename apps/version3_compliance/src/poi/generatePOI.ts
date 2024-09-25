import axios from 'axios';
import { buildMerkleTree } from "../pool/poolFunctions";
import { checkSanctionedAddress } from "./checkIfSanctioned";
import { CommitmentEvents } from "../pool/types";
import { toFixedHex } from "../utils/toHex";
import { GeneratePOIParams } from "../pool/types";

const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || '';
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

export async function generatePOI(params: GeneratePOIParams, n: number = 10) { // n is the number of events in order to build the merkle tree for the POI
    
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

    let events_ = []; // this will be the array of events that will be used to build the POI

    // here we add events associated with user's input utxos
    for (const input of inputs) {
        if (input.amount > 0) {
            const event = events.find(event => event.commitment === toFixedHex(input.commitment));
            
            if (event) {
                events_.push(event); 
            }
        }
    }

    // here we add events only associated to deposits and with a not sanctioned address
    for (const event of events) {
        const transactionHash = event.transactionHash;
        const receipt = await hre.ethers.provider.getTransactionReceipt(transactionHash);
        receipt.logs.forEach((log, index) => {
            if (index === 5 && log.topics.length === 4) { // length 4 means it's a deposit event
                const address = '0x' + log.topics[2].slice(26)
                if (address !== RELAYER_ADDRESS && address !== params.senderAddress) {
                    console.log(address);
                    events_.push(event);
                }         
            }
        })
    }

    
    console.log(events_);

    events_ = shuffleEvents(events_);

    const tree = await buildMerkleTree({ events: events_ });

}