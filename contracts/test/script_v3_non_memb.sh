#!/bin/bash -e
POWERS_OF_TAU=18 # circuit will support max 2^POWERS_OF_TAU constraints
mkdir -p artifacts/
if [ ! -f artifacts/ptau$POWERS_OF_TAU ]; then
  echo "Downloading powers of tau file"
  curl -L https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_$POWERS_OF_TAU.ptau --create-dirs -o artifacts/ptau$POWERS_OF_TAU
fi
npx circom -v -r artifacts/non_membership.r1cs -w artifacts/non_membership.wasm -s artifacts/non_membership.sym ./non_membership.circom
npx snarkjs groth16 setup artifacts/non_membership.r1cs artifacts/ptau$POWERS_OF_TAU artifacts/non_membership_0.zkey
npx snarkjs zkey contribute artifacts/non_membership_0.zkey artifacts/non_membership_1.zkey
npx snarkjs zkey beacon artifacts/non_membership_1.zkey artifacts/non_membership.zkey e586fccaf245c9a1d7e78294d4802018f3001149a71b8f10cd997ef8235aa372 10
npx snarkjs zkey export verificationkey artifacts/non_membership.zkey artifacts/verification_key.json
# npx snarkjs zkey export solidityverifier artifacts/non_membership.zkey artifacts/VerifierNonMembership.sol
npx snarkjs info -r artifacts/non_membership.r1cs
