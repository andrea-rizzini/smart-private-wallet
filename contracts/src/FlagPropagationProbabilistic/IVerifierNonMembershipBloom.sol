// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

interface IVerifierNonMembershipBloom {
   function verifyProofBloom(bytes memory _proof, uint256[3] memory _input) external view returns (bool);
}

