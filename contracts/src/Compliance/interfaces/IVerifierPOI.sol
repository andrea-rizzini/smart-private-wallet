// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

interface IVerifierPOI {
  function verifyPOI(bytes memory _proof, uint256[3] memory _input) external view returns (bool);

  function verifyPOI(bytes memory _proof, uint256[17] memory _input) external view returns (bool);
}
