include "../../node_modules/circomlib/circuits/poseidon.circom";
include "./v2_transfers/merkleProof.circom"
include "./v2_transfers/keypair.circom"

template poi(levels, nIns) {
    signal         input rootPOI;

    signal private input inPathIndicesPOI[nIns];
    signal private input inPathElementsPOI[nIns][levels];
    signal private input inAmountPOI[nIns];
    signal private input inPreimagesPOI[nIns];

    component inCommitmentHasher[nIns];
    component inTree[nIns];
    component inCheckRoot[nIns];

    for (var tx = 0; tx < nIns; tx++) {

        inCommitmentHasher[tx] = Poseidon(1);
        inCommitmentHasher[tx].inputs[0] <== inPreimagesPOI[tx];

        inTree[tx] = MerkleProof(levels);
        inTree[tx].leaf <== inCommitmentHasher[tx].out;
        inTree[tx].pathIndices <== inPathIndicesPOI[tx];
        for (var i = 0; i < levels; i++) {
            inTree[tx].pathElements[i] <== inPathElementsPOI[tx][i];
        }

        // check merkle proof only if amount is non-zero
        inCheckRoot[tx] = ForceEqualIfEnabled(); // in comparators.circom, which is imported in bitify.circom, which is imported in merkleProof.circom
        inCheckRoot[tx].in[0] <== rootPOI;
        inCheckRoot[tx].in[1] <== inTree[tx].root;
        inCheckRoot[tx].enabled <== inAmountPOI[tx]; // if amount is zero, we don't need to check the merkle proof. The check is inside the ForceEqualIfEnabled component.

    }

}