include "../../node_modules/circomlib/circuits/poseidon.circom";
include "../v2_transfers/merkleProof.circom"
include "../v2_transfers/keypair.circom"

template poi(levels, nIns, zeroLeaf) {
    signal         input root;
    signal         input inputNullifiers[nIns];
    signal private input inAmount[nIns];
    signal private input inPrivateKey[nIns];
    signal private input inBlinding[nIns];
    signal private input inPathIndices[nIns];
    signal private input inPathElements[nIns][levels];

    component inKeypair[nIns];
    component inCommitmentHasher[nIns];
    component inTree[nIns];
    component inCheckRoot[nIns];

    for (var tx = 0; tx < nIns; tx++) {
        inKeypair[tx] = Keypair();
        inKeypair[tx].privateKey <== inPrivateKey[tx];

        inCommitmentHasher[tx] = Poseidon(3);
        inCommitmentHasher[tx].inputs[0] <== inAmount[tx];
        inCommitmentHasher[tx].inputs[1] <== inKeypair[tx].publicKey;
        inCommitmentHasher[tx].inputs[2] <== inBlinding[tx];
            
        inTree[tx] = MerkleProof(levels);
        inTree[tx].leaf <== inCommitmentHasher[tx].out;
        inTree[tx].pathIndices <== inPathIndices[tx];
        for (var i = 0; i < levels; i++) {
            inTree[tx].pathElements[i] <== inPathElements[tx][i];
        }

        // check merkle proof only if amount is non-zero
        inCheckRoot[tx] = ForceEqualIfEnabled(); // in comparators.circom, which is imported in bitify.circom, which is imported in merkleProof.circom
        inCheckRoot[tx].in[0] <== root;
        inCheckRoot[tx].in[1] <== inTree[tx].root;
        inCheckRoot[tx].enabled <== inAmount[tx]; // if amount is zero, we don't need to check the merkle proof. The check is inside the ForceEqualIfEnabled component.

    }

}