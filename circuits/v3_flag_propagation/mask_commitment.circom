include "../../node_modules/circomlib/circuits/poseidon.circom";

template MaskCommitmentCheck () {

    signal input maskedCommitment;

    signal private input commitment;
    signal private input blinding;

    component inCommitmentHasher = Poseidon(2);
    inCommitmentHasher.inputs[0] <== commitment;
    inCommitmentHasher.inputs[1] <== blinding;

    inCommitmentHasher.out === maskedCommitment;
}

component main = MaskCommitmentCheck();