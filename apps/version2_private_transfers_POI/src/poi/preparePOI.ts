import hre from "hardhat"
import fs from 'fs'
import path from 'path'

import { ArgsPOI } from "../pool/types"
import { CommitmentPOIEvents } from "../pool/types"
import { fetchCommitmentsPOI } from "../pool/poolFunctions"
import { getUserAccountInfo } from "../pool/poolFunctions"
// @ts-ignore
import MerkleTree from 'fixed-merkle-tree';
import { prove } from "../proof/prover"
import { poseidonHash2 } from "../utils/hashFunctions"
import { toFixedHex } from "../utils/toHex"
import { Utxo } from "../pool/utxo";

const MERKLE_TREE_HEIGHT = 20;

function buildMerkleTree({ POIevents }: { POIevents: CommitmentPOIEvents }): typeof MerkleTree {
    const leaves = POIevents.sort((a, b) => a.index - b.index).map((e) => toFixedHex(e.commitment))
    return new MerkleTree(MERKLE_TREE_HEIGHT, leaves, { hashFunction: poseidonHash2 })
}

export async function preparePOI(amount: string, username: string, addressSender: string, signer: any) {
    const { unspentUtxo, totalAmount, senderKeyPair } = await getUserAccountInfo(username, addressSender, {amount: hre.ethers.parseUnits(amount, 6)})
    while (unspentUtxo.length !== 2 && unspentUtxo.length < 16) {
        unspentUtxo.push(new Utxo())
    }
    const POIevents = await fetchCommitmentsPOI();
    const allowed = 1;

    const tree = await buildMerkleTree({ POIevents })

    const inputMerklePathIndicesPOI = []
    const inputMerklePathElementsPOI = []

    const preimages = []
    const inAmount = []

    for (const utxo of unspentUtxo) {
        for (const POIevent of POIevents) {
            if (utxo.index === POIevent.index) {
                inputMerklePathIndicesPOI.push(POIevent.index)
                inputMerklePathElementsPOI.push(tree.path(POIevent.index).pathElements)
                preimages.push(allowed)
                inAmount.push(utxo.amount)
            }
        }
    }

    while (preimages.length !== 2 && preimages.length < 16) {
        inputMerklePathIndicesPOI.push(0)
        inputMerklePathElementsPOI.push(new Array(MERKLE_TREE_HEIGHT).fill(0))
        preimages.push(0) // any value, since in the check these will be skipped
        inAmount.push(0) // this is a flag to to indicate circom not to check merkle path of this
    }

    const root = tree.root();

    const input = {
        // public input
        rootPOI: root,

        // private input
        inPathIndicesPOI: inputMerklePathIndicesPOI,
        inPathElementsPOI: inputMerklePathElementsPOI,
        inAmountPOI: inAmount,
        inPreimagesPOI: preimages,
    }

    let dirPath = path.join(__dirname, `../../../../circuits/artifacts/circuits/`);
    let fileName = `poi${preimages.length}.wasm`;
    let filePath = path.join(dirPath, fileName);
    let wasmBuffer = fs.readFileSync(filePath);
    
    fileName = `poi${preimages.length}.zkey`;
    filePath = path.join(dirPath, fileName);
    let zKeyBuffer = fs.readFileSync(filePath);

    // @ts-ignore
    const proof = await prove(input, wasmBuffer, zKeyBuffer)

    const argsPOI: ArgsPOI = {
        proof,
        root: toFixedHex(root),
    }

    return {
        argsPOI,
    }

}