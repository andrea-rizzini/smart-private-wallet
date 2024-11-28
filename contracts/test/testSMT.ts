import hre from "hardhat";
import fs from "fs";
import path from "path";

// @ts-ignore
import * as snarkjs from 'snarkjs'

import { newMemEmptyTrie } from "circomlibjs";
import { prove, proveRaw } from "../../apps/version3_flag_propagation/src/proof/prover";
import { poseidonHash, poseidonHash2, posidonHash3 } from "../../apps/version3_flag_propagation/src/utils/hashFunctions";

import { SMT } from "@zk-kit/smt";
import { SMT as SMT_V2 } from "circomlibjs";
import { StatusTreeEvents } from "../../apps/version3_flag_propagation/src/pool/types";
import { toFixedHex } from "../../apps/version3_flag_propagation/src/utils/toHex";

const MIXER_ONBOARDING_AND_TRANSFERS_V3 = process.env.MIXER_ONBOARDING_AND_TRANSFERS_V3 || '';
const TEST_SMT = process.env.TEST_SMT || '';

function padSiblings(siblings: bigint[], height: number): bigint[] {
  return siblings.length < height
      ? siblings.concat(Array(height - siblings.length).fill(0n))
      : siblings;
}

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

async function buildSMTree({ events }: { events: StatusTreeEvents }): Promise<SMT>  /*MerkleTreeIden3*/ {
  const smt_ = new SMT(poseidonHash, true);
  // for (const event of events) {
  //   smt_.add(BigInt(event.index), BigInt(event.maskedCommitment))
  // }

  smt_.add(BigInt(1), BigInt(10))
  smt_.add(BigInt(3), BigInt(5))
  smt_.add(BigInt(25), BigInt(15))

  console.log("Root: ", smt_.root)

  return smt_

}

async function buildSMTreeV2({ events }: { events: StatusTreeEvents }): Promise<SMT_V2>  /*MerkleTreeIden3*/ {

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

async function main() {
  const eventsStatusTree = await fetchStatusTreeEvents()
  const smt = await buildSMTree({ events: eventsStatusTree })
  //const tree = await buildSMTreeV2({ events: eventsStatusTree })

  const proof_for_1 = smt.createProof(BigInt(1));
  const proof_for_3 = smt.createProof(BigInt(3));
  const proof_for_25 = smt.createProof(BigInt(25));
  const proof_for_5 = smt.createProof(BigInt(5));

  proof_for_1.siblings = padSiblings(proof_for_1.siblings as bigint[], 20);
  proof_for_3.siblings = padSiblings(proof_for_3.siblings as bigint[], 20);
  proof_for_25.siblings = padSiblings(proof_for_25.siblings as bigint[], 20);
  proof_for_5.siblings = padSiblings(proof_for_5.siblings as bigint[], 20);

  // console.log(`Proof for 3: `, proof_for_3)
  // console.log(`Proof for 1: `, proof_for_1)

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

  // const digest = posidonHash3("3", "5", "1").toString()
  // console.log("Digest: ", digest)

  // prepare the input for the circuit

  // correct proof, non membership of 5
  const input = {
    enabled: 1,
    root: smt.root,
    siblings: proof_for_5.siblings,
    oldKey: 0,
    oldValue: 0,
    isOld0: 1,
    key: 5,
    value: 0,
    fnc: 1
  }

  // correct proof, membership of 1
  // const input = {
  //   enabled: 1,
  //   root: smt.root,
  //   siblings: proof_for_1.siblings,
  //   oldKey: 0,
  //   oldValue: 0,
  //   isOld0: 0,
  //   key: 1,
  //   value: 10,
  //   fnc: 0
  // }

  // uncorrect proof, non membership of 1 that is actually in the tree
  // const input = {
  //   enabled: 1,
  //   root: smt.root,
  //   siblings: proof_for_1.siblings,
  //   oldKey: 0,
  //   oldValue: 0,
  //   isOld0: 1,
  //   key: 1,
  //   value: 0,
  //   fnc: 1
  // }

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