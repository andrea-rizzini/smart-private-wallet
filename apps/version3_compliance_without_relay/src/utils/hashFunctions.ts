// @ts-ignore
import * as circomlib from 'circomlib'

export function poseidonHash(items: any[]) {
    //const poseidon = circomlib.poseidon.createHash();
    return BigInt(circomlib.poseidon(items).toString())
}

export function poseidonHash2(a: string, b: string) {
    return poseidonHash([a, b])
}