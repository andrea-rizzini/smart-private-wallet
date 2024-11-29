// @ts-ignore
import * as circomlib from 'circomlib'

export function poseidonHash(items: any[]) {
    //const poseidon = circomlib.poseidon.createHash();
    return BigInt(circomlib.poseidon(items).toString())
}

export function poseidonHash2(a: string, b: string) {
    return poseidonHash([a, b])
}

export function poseidonHash3(a: string, b: string, c: string) {
    return poseidonHash([a, b, c])
}