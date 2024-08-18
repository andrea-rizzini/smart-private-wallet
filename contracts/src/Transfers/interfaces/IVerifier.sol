// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

interface IVerifier {
  function verifyProof(bytes memory _proof, uint256[6] memory _input) external view returns (bool);

  function verifyProof(bytes memory _proof, uint256[20] memory _input) external view returns (bool);
}
