#!/bin/bash -e
POWERS_OF_TAU=18 # circuit will support max 2^POWERS_OF_TAU constraints
CUSTOM_NAME_1="VerifierMaskCommitment"
CUSTOM_NAME_2="VerifierNonMembershipBloom"
mkdir -p artifacts/circuits
if [ ! -f artifacts/circuits/ptau$POWERS_OF_TAU ]; then
  echo "Downloading powers of tau file"
  curl -L https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_$POWERS_OF_TAU.ptau --create-dirs -o artifacts/circuits/ptau$POWERS_OF_TAU
fi

npx circom -v -r artifacts/circuits/mask_commitment.r1cs -w artifacts/circuits/mask_commitment.wasm -s artifacts/circuits/mask_commitment.sym v3_flag_propagation/mask_commitment.circom
npx snarkjs groth16 setup artifacts/circuits/mask_commitment.r1cs artifacts/circuits/ptau$POWERS_OF_TAU artifacts/circuits/mask_commitment_0.zkey
npx snarkjs zkey contribute artifacts/circuits/mask_commitment_0.zkey artifacts/circuits/mask_commitment_1.zkey
npx snarkjs zkey beacon artifacts/circuits/mask_commitment_1.zkey artifacts/circuits/mask_commitment.zkey e586fccaf245c9a1d7e78294d4802018f3001149a71b8f10cd997ef8235aa372 10
npx snarkjs zkey export solidityverifier artifacts/circuits/mask_commitment.zkey artifacts/circuits/VerifierMaskCommitment.sol
sed -i "s/contract Verifier/contract $CUSTOM_NAME_1/" artifacts/circuits/VerifierMaskCommitment.sol
sed -i "s/function verifyProof/function verifyProofMaskCommitment/" artifacts/circuits/VerifierMaskCommitment.sol
npx snarkjs info -r artifacts/circuits/mask_commitment.r1cs

npx circom -v -r artifacts/circuits/non_membership_bloom.r1cs -w artifacts/circuits/non_membership_bloom.wasm -s artifacts/circuits/non_membership_bloom.sym v3_flag_propagation_probabilistic/non_membership_bloom.circom
npx snarkjs groth16 setup artifacts/circuits/non_membership_bloom.r1cs artifacts/circuits/ptau$POWERS_OF_TAU artifacts/circuits/non_membership_bloom_0.zkey
npx snarkjs zkey contribute artifacts/circuits/non_membership_bloom_0.zkey artifacts/circuits/non_membership_bloom_1.zkey
npx snarkjs zkey beacon artifacts/circuits/non_membership_bloom_1.zkey artifacts/circuits/non_membership_bloom.zkey e586fccaf245c9a1d7e78294d4802018f3001149a71b8f10cd997ef8235aa372 10
npx snarkjs zkey export solidityverifier artifacts/circuits/non_membership_bloom.zkey artifacts/circuits/VerifierNonMembershipBloom.sol
sed -i "s/contract Verifier/contract $CUSTOM_NAME_2/" artifacts/circuits/VerifierNonMembershipBloom.sol
sed -i "s/function verifyProof/function verifyProofBloom/" artifacts/circuits/VerifierNonMembershipBloom.sol
npx snarkjs info -r artifacts/circuits/non_membership_bloom.r1cs