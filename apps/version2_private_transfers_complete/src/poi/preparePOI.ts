import hre from "hardhat"

import { CommitmentPOIEvents } from "../pool/types"
import { fetchCommitmentsPOI } from "../pool/poolFunctions"
import { getUserAccountInfo } from "../pool/poolFunctions"
// @ts-ignore
import MerkleTree from 'fixed-merkle-tree';
import { poseidonHash, poseidonHash2 } from "../utils/hashFunctions"
import { toFixedHex } from "../utils/toHex"

const MERKLE_TREE_HEIGHT = 20;

function buildMerkleTree({ POIevents }: { POIevents: CommitmentPOIEvents }): typeof MerkleTree {
    const leaves = POIevents.sort((a, b) => a.index - b.index).map((e) => toFixedHex(e.commitment))
    return new MerkleTree(MERKLE_TREE_HEIGHT, leaves, { hashFunction: poseidonHash2 })
  }

export async function preparePOI(amount: string, username: string, addressSender: string, signer: any) {
    const { unspentUtxo, totalAmount, senderKeyPair } = await getUserAccountInfo(username, addressSender, {amount: hre.ethers.parseUnits(amount, 6)})
    const POIevents = await fetchCommitmentsPOI();
    const allowed = 1;

    const tree = await buildMerkleTree({ POIevents })

    const inputMerklePathIndicesPOI = []
    const inputMerklePathElementsPOI = []

    const preimages = []

    for (const utxo of unspentUtxo) {
        for (const POIevent of POIevents) {
            if (utxo.index === POIevent.index) {
                inputMerklePathIndicesPOI.push(POIevent.index)
                inputMerklePathElementsPOI.push(tree.path(POIevent.index).pathElements)
                preimages.push(allowed)
            }
        }
    }

    const root = tree.root();

    const input = {
        // public input
        root: root,

        // private input
        inPreimages: preimages,
        inPathIndices: inputMerklePathIndicesPOI,
        inPathElements: inputMerklePathElementsPOI,
    }

}