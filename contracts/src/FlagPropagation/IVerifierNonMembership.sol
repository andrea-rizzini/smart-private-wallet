// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

interface IVerifierNonMembership {
   function verifyProofNonMembership(bytes memory _proof, uint256[1] memory _input) external view returns (bool);
}

