import hre from "hardhat";
import fs from "fs";
import path from "path";

// @ts-ignore
import * as circomlib from 'circomlib'

// @ts-ignore
import * as snarkjs from 'snarkjs'

import { BigNumberish } from "circomlibjs";
import { buildPoseidon, buildPoseidonOpt, newMemEmptyTrie } from "circomlibjs";
import { prove, proveRaw } from "../../apps/version3_flag_propagation/src/proof/prover";

import { SMT } from "@zk-kit/smt";
import { SMT as SMT_V2 } from "circomlibjs";
import { StatusTreeEvents } from "../../apps/version3_flag_propagation/src/pool/types";
import { toFixedHex } from "../../apps/version3_flag_propagation/src/utils/toHex";

var ffjavascript = require('ffjavascript');

const MIXER_ONBOARDING_AND_TRANSFERS_V3 = process.env.MIXER_ONBOARDING_AND_TRANSFERS_V3 || '';
const TEST_SMT = process.env.TEST_SMT || '';

async function fetchStatusTreeEvents(): Promise<StatusTreeEvents> {
  const contract = await hre.ethers.getContractAt("contracts/src/FlagPropagation/MixerOnboardingAndTransfersV3.sol:MixerOnboardingAndTransfers", MIXER_ONBOARDING_AND_TRANSFERS_V3);
  const filter = contract.filters.StatusFlagged();
  const events = await contract.queryFilter(filter);
  const statusTreeEvents: StatusTreeEvents = [];
  events.forEach((event) => {
    statusTreeEvents.push({
      blockNumber: event.blockNumber,
      transactionHash: event.transactionHash,
      // @ts-ignore
      index: Number(event.args[0]),
      // @ts-ignore
      maskedCommitment: event.args[1]
    })
  });
  return statusTreeEvents
}

// async function getHashes() {
//     const bn128 = await ffjavascript.getCurveFromName("bn128", true);
//     const poseidon = await buildPoseidonOpt();
//     return {
//         hash0: function (left, right) {
//             return poseidon([left, right]);
//         },
//         hash1: function(key, value) {
//             return poseidon([key, value, bn128.Fr.one]);
//         },
//         F: bn128.Fr
//     }
// }

async function buildSMTreeV2({ events }: { events: StatusTreeEvents }): Promise<SMT_V2> {

  const tree = await newMemEmptyTrie();

  // for (const event of events) {
  //   tree.insert(event.index, event.maskedCommitment)
  // }

  await tree.insert(3, 5);
  await tree.insert(1, 10);
  await tree.insert(25, 15);

  console.log("Root: ", tree.F.toObject(tree.root))

  return tree

}

async function getInputInclusion(tree: SMT_V2, _key: number) {
    const key = tree.F.e(_key);
    const res = await tree.find(key);

    let siblings = res.siblings;
    for (let i=0; i<siblings.length; i++) siblings[i] = tree.F.toObject(siblings[i]);
    while (siblings.length<10) siblings.push(0);

    const input = {
        enabled: 1,
        fnc: 0,
        root: tree.F.toObject(tree.root),
        siblings: siblings,
        oldKey: 0,
        oldValue: 0,
        isOld0: 0,
        key: tree.F.toObject(key),
        value: tree.F.toObject(res.foundValue)
    };

    return input;

}

async function getInputExclusion(tree: SMT_V2, _key: number) {
    const key = tree.F.e(_key);
    const res = await tree.find(key);

    let siblings = res.siblings;
    for (let i=0; i<siblings.length; i++) siblings[i] = tree.F.toObject(siblings[i]);
    while (siblings.length<10) siblings.push(0);

    const input = {
        enabled: 1,
        fnc: 1,
        root: tree.F.toObject(tree.root),
        siblings: siblings,
        oldKey: res.isOld0 ? 0 : tree.F.toObject(res.notFoundKey),
        oldValue: res.isOld0 ? 0 : tree.F.toObject(res.notFoundValue),
        isOld0: res.isOld0 ? 1 : 0,
        key: tree.F.toObject(key),
        value: 0
    };

    return input;

}

async function main() {
  const eventsStatusTree = await fetchStatusTreeEvents()
  const smt = await buildSMTreeV2({ events: eventsStatusTree })

  const signers = await hre.ethers.getSigners();
  const contract = await hre.ethers.getContractAt("TestSMT", TEST_SMT, signers[2]);
  // await contract.add(toFixedHex(3), toFixedHex(5))
  // await contract.add(toFixedHex(1), toFixedHex(10))
  // await contract.add(toFixedHex(25), toFixedHex(15))

  const root = await contract.getRoot()
  console.log("Root: ", root)

  // const proof1 = await contract.getProof(toFixedHex(3))
  // console.log(`Proof for 3: `, proof1)

  // const proof2 = await contract.getProof(toFixedHex(1))
  // console.log(`Proof for 1: `, proof2)

  // const proof3 = await contract.getProof(toFixedHex(25))
  // console.log(`Proof for 25: `, proof3)

  // const node1 = await contract.getNodeByKey(toFixedHex(3))
  // console.log(`Node for 3: `, node1)

  // prepare the input for the circuit

  // correct proof, non membership of 5
  const input = getInputExclusion(smt, 5);

  // correct proof, membership of 1 
  // const input = getInputInclusion(smt, 1);

  // uncorrect proof, non membership of 1 that is actually in the tree
  // const input = getInputExclusion(smt, 1);

  // read the wasm file
  let dirPath = path.join(__dirname, `./artifacts/`);
  let fileName = `non_membership.wasm`;
  let filePath = path.join(dirPath, fileName);
  const wasmBuffer = fs.readFileSync(filePath);

  // read the proving key
  fileName = `non_membership.zkey`;
  filePath = path.join(dirPath, fileName);
  const zKeyBuffer = fs.readFileSync(filePath);

  // generating the proof
  // @ts-ignore
  const {proof, publicSignals} = await proveRaw(input, wasmBuffer, zKeyBuffer)
  // console.log("Proof: ", proof)
  // console.log("Public signals: ", publicSignals)

  // verification
  fileName = "verification_key.json";
  filePath = path.join(dirPath, fileName);
  const vKey = JSON.parse(fs.readFileSync(filePath).toString());

  const res_ = await snarkjs.groth16.verify(vKey, publicSignals, proof);

  if (res_ === true) {
    console.log("Verification OK");
  } else {
      console.log("Invalid proof");
  }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })