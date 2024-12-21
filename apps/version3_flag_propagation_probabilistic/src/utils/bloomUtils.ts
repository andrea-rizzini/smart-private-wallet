import { poseidonHash as hasher } from "./hashFunctions";

const SMT_DEPTH = 20;

export async function computeBloomIndices(key: bigint, filterSize: number) {
    const hash1 = hasher([key]);
    const hash2 = hasher([hash1]);
    
    const index1 = Number(hash1 % BigInt(filterSize));
    const index2 = Number(hash2 % BigInt(filterSize));
    
    return [index1, index2];
}

export function createBitArray(size: number, indices: number[]) {
    const arr = new Array(size).fill(0);
    indices.forEach(idx => arr[idx] = 1);
    return arr;
}

export function bits2Num(bits: number[]) {
    return bits.reduce((acc, bit, i) => {
        return acc + BigInt(bit) * (2n ** BigInt(i));
    }, 0n);
}

export async function generateCircuitInput(bitArray1: number[], bitArray2: number[], smtData: any) {
    return {
        bitArray: bitArray1,
        bitArray2: bitArray2,
        root: smtData.root,
        siblings: smtData.proof.siblings,
        key: smtData.key,
        value: smtData.masked_commitment,
        auxKey: 0,
        auxValue: 0,
        auxIsEmpty: 0, 
        isExclusion: 0,
        // k: "2"
    };
}

function padSiblings(siblings: bigint[], height: number): bigint[] {
    return siblings.length < height
        ? siblings.concat(Array(height - siblings.length).fill(0n))
        : siblings;
  }

export async function argumentsSMT(smt: any, key: bigint, masked_commitment: bigint) {
    
    // generate inclusion proof
    const proof = smt.createProof(key);
    const paddedSiblings = padSiblings(proof.siblings, SMT_DEPTH);
    
    return {
        key,
        proof: { ...proof, siblings: paddedSiblings},
        root: smt.root,
        masked_commitment
    };
}
