import hre from "hardhat";
import { poseidonHash, poseidonHash2, posidonHash3 } from "../../apps/version3_flag_propagation/src/utils/hashFunctions";
import { SMT } from "@zk-kit/smt";
import { StatusTreeEvents } from "../../apps/version3_flag_propagation/src/pool/types";
import { toFixedHex } from "../../apps/version3_flag_propagation/src/utils/toHex";

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
        index: Number(event.args[0]),
        maskedCommitment: event.args[1]
      })
    });
    return statusTreeEvents
  }

async function buildSMTree({ events }: { events: StatusTreeEvents }) /* SMT */ /*MerkleTreeIden3*/ {
    const smt_ = new SMT(poseidonHash, true);
    // for (const event of events) {
    //   smt_.add(BigInt(event.index), BigInt(event.maskedCommitment))
    // }
    smt_.add(BigInt(3), BigInt(5))
    smt_.add(BigInt(1), BigInt(10))
    smt_.add(BigInt(25), BigInt(15))
    console.log("Root: ", smt_.root)

    console.log(`Proof for 3: `, smt_.createProof(BigInt(3)))
    console.log(`Proof for 1: `, smt_.createProof(BigInt(1)))
    console.log(`Proof for 25: `, smt_.createProof(BigInt(25)))

}

async function main() {
    const eventsStatusTree = await fetchStatusTreeEvents()
    await buildSMTree({ events: eventsStatusTree })

    const signers = await hre.ethers.getSigners();
    const contract = await hre.ethers.getContractAt("TestSMT", TEST_SMT, signers[2]);
    // await contract.add(toFixedHex(3), toFixedHex(5))
    // await contract.add(toFixedHex(1), toFixedHex(10))
    // await contract.add(toFixedHex(25), toFixedHex(15))

    const root = await contract.getRoot()
    console.log("Root: ", root)

    const proof1 = await contract.getProof(toFixedHex(3))
    console.log(`Proof for 3: `, proof1)

    // const proof2 = await contract.getProof(toFixedHex(1))
    // console.log(`Proof for 1: `, proof2)
    // const proof3 = await contract.getProof(toFixedHex(25))
    // console.log(`Proof for 25: `, proof3)

    const node1 = await contract.getNodeByKey(toFixedHex(3))
    console.log(`Node for 3: `, node1)

    const digest = posidonHash3("3", "5", "1").toString()
    console.log("Digest: ", digest)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })