import hre from "hardhat";
import { poseidonHash } from "../utils/hashFunctions";
import { SMT } from "@zk-kit/smt";
import { StatusTreeEvents } from "../pool/types";

const MIXER_ONBOARDING_AND_TRANSFERS_V3 = process.env.MIXER_ONBOARDING_AND_TRANSFERS_V3 || '';

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
    console.log("Root: ", smt_.root)

    console.log(`Proof for 3: `, smt_.createProof(BigInt(3)))
    console.log(`Proof for 1: `, smt_.createProof(BigInt(1)))

}

async function main() {
    const eventsStatusTree = await fetchStatusTreeEvents()
    await buildSMTree({ events: eventsStatusTree })
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })