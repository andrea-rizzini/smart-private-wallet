// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

interface IVerifier {
  function verifyProof(bytes memory _proof, uint256[6] memory _input) external view returns (bool);

  function verifyProof(bytes memory _proof, uint256[20] memory _input) external view returns (bool);
}

interface IVerifierPOI {
  function verifyPOI2(bytes memory _proof, uint256[1] memory _input) external view returns (bool); // the input is just the root. We need 2 functions: one for 2 round and the other for 16

  function verifyPOI16(bytes memory _proof, uint256[1] memory _input) external view returns (bool);
}