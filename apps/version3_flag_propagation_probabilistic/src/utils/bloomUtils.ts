import { poseidonHash as hasher } from "./hashFunctions";

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