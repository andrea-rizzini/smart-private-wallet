// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.9;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import { IVerifier } from "../Transfers/interfaces/IVerifier.sol";
import { IVerifierPOI } from "./interfaces/IVerifierPOI.sol";
import "../Transfers/MerkleTreeWithHistoryTransactions.sol";

contract UTXOsPoolWithCompliance is MerkleTreeWithHistory, ReentrancyGuard {

  IVerifier public immutable verifier2;
  IVerifier public immutable verifier16;

  IVerifierPOI public immutable verifierPOI2;
  IVerifierPOI public immutable verifierPOI16;

  uint256 public lastBalance;
  uint256 public maximumDepositAmount = 100 ether;
  mapping(bytes32 => bool) public nullifierHashes;

  struct ExtData {
    address recipient;
    int256 extAmount;
    bytes encryptedOutput1;
    bytes encryptedOutput2;
  }

  struct Proof {
    bytes proof;
    bytes32 root;
    bytes32[] inputNullifiers;
    bytes32[2] outputCommitments;
    uint256 publicAmount;
    bytes32 extDataHash;
  }

  struct POI {
    bytes proof;
    bytes32 root;
    bytes32[] inputNullifiers;
  }

  event NewCommitment(bytes32 commitment, uint256 index, bytes encryptedOutput);
  event NewNullifier(bytes32 nullifier);

  constructor(
    IVerifier _verifier2,
    IVerifier _verifier16,
    IVerifierPOI _verifierPOI2,
    IVerifierPOI _verifierPOI16,
    uint32 _levels,
    address _hasher
  )
    MerkleTreeWithHistory(_levels, _hasher)
  {
    verifier2 = _verifier2;
    verifier16 = _verifier16;
    verifierPOI2 = _verifierPOI2;
    verifierPOI16 = _verifierPOI16;
    super._initialize();
  }

  // function that allow deposits, since they don't need the POI in this version we need a different function
  function deposit(Proof memory _args, ExtData memory _extData) external payable { 
    if (_extData.extAmount > 0) {
      require(uint256(_extData.extAmount) <= maximumDepositAmount, "amount is larger than maximumDepositAmount");
    }
     _deposit(_args, _extData);
  }

  function _deposit(Proof memory _args, ExtData memory _extData) internal nonReentrant {
    require(isKnownRoot(_args.root), "Invalid merkle root");
    for (uint256 i = 0; i < _args.inputNullifiers.length; i++) {
      require(!isSpent(_args.inputNullifiers[i]), "Input is already spent");
    }
    require(uint256(_args.extDataHash) == uint256(keccak256(abi.encode(_extData))) % FIELD_SIZE, "Incorrect external data hash");
    require(verifyProof(_args), "Invalid transaction proof");

    for (uint256 i = 0; i < _args.inputNullifiers.length; i++) {
      nullifierHashes[_args.inputNullifiers[i]] = true;
    }

    // lastBalance = token.balanceOf(address(this));
    _insert(_args.outputCommitments[0], _args.outputCommitments[1]);
    emit NewCommitment(_args.outputCommitments[0], nextIndex - 2, _extData.encryptedOutput1);
    emit NewCommitment(_args.outputCommitments[1], nextIndex - 1, _extData.encryptedOutput2);
    for (uint256 i = 0; i < _args.inputNullifiers.length; i++) {
      emit NewNullifier(_args.inputNullifiers[i]);
    }
  }

  // function that allows transfers and withdrawal
  function transact(Proof memory _args, POI memory _args_poi, ExtData memory _extData) external payable { 
    if (_extData.extAmount > 0) {
      require(uint256(_extData.extAmount) <= maximumDepositAmount, "amount is larger than maximumDepositAmount");
    }
    // first verify the POI, then the transaction
    require(verifyPOI(_args_poi), "Invalid POI proof");
    _transact(_args, _extData);
  }

  function _transact(Proof memory _args, ExtData memory _extData) internal nonReentrant {
    require(isKnownRoot(_args.root), "Invalid merkle root");
    for (uint256 i = 0; i < _args.inputNullifiers.length; i++) {
      require(!isSpent(_args.inputNullifiers[i]), "Input is already spent");
    }
    require(uint256(_args.extDataHash) == uint256(keccak256(abi.encode(_extData))) % FIELD_SIZE, "Incorrect external data hash");
    require(verifyProof(_args), "Invalid transaction proof");

    for (uint256 i = 0; i < _args.inputNullifiers.length; i++) {
      nullifierHashes[_args.inputNullifiers[i]] = true;
    }

    if (_extData.extAmount < 0) { // we enter here only if the operation is a withdrawal
      require(_extData.recipient != address(0), "Can't withdraw to zero address");
      (bool success, ) = _extData.recipient.call{ value: uint256(-_extData.extAmount) }("");
      require(success, "payment to _recipient did not go thru");
    }

    // lastBalance = token.balanceOf(address(this));
    _insert(_args.outputCommitments[0], _args.outputCommitments[1]);
    emit NewCommitment(_args.outputCommitments[0], nextIndex - 2, _extData.encryptedOutput1);
    emit NewCommitment(_args.outputCommitments[1], nextIndex - 1, _extData.encryptedOutput2);
    for (uint256 i = 0; i < _args.inputNullifiers.length; i++) {
      emit NewNullifier(_args.inputNullifiers[i]);
    }
  }
  

  function isSpent(bytes32 _nullifierHash) public view returns (bool) {
    return nullifierHashes[_nullifierHash];
  }

  function verifyProof(Proof memory _args) public view returns (bool) {
    if (_args.inputNullifiers.length == 2) {
      return
        verifier2.verifyProof(
          _args.proof,
          [
            uint256(_args.root),
            _args.publicAmount,
            //uint256(_args.extDataHash),
            uint256(_args.inputNullifiers[0]),
            uint256(_args.inputNullifiers[1]),
            uint256(_args.outputCommitments[0]),
            uint256(_args.outputCommitments[1])
          ]
        );
    } else if (_args.inputNullifiers.length == 16) {
      return
        verifier16.verifyProof(
          _args.proof,
          [
            uint256(_args.root),
            _args.publicAmount,
            //uint256(_args.extDataHash),
            uint256(_args.inputNullifiers[0]),
            uint256(_args.inputNullifiers[1]),
            uint256(_args.inputNullifiers[2]),
            uint256(_args.inputNullifiers[3]),
            uint256(_args.inputNullifiers[4]),
            uint256(_args.inputNullifiers[5]),
            uint256(_args.inputNullifiers[6]),
            uint256(_args.inputNullifiers[7]),
            uint256(_args.inputNullifiers[8]),
            uint256(_args.inputNullifiers[9]),
            uint256(_args.inputNullifiers[10]),
            uint256(_args.inputNullifiers[11]),
            uint256(_args.inputNullifiers[12]),
            uint256(_args.inputNullifiers[13]),
            uint256(_args.inputNullifiers[14]),
            uint256(_args.inputNullifiers[15]),
            uint256(_args.outputCommitments[0]),
            uint256(_args.outputCommitments[1])
          ]
        );
    } else {
      revert("unsupported input count");
    }
  }

  function verifyPOI(POI memory _args_poi) public view returns (bool) {
    if (_args_poi.inputNullifiers.length == 2) {
      return
        verifierPOI2.verifyPOI(
          _args_poi.proof,
          [
            uint256(_args_poi.root),
            uint256(_args_poi.inputNullifiers[0]),
            uint256(_args_poi.inputNullifiers[1])
          ]
        );
    } else if (_args_poi.inputNullifiers.length == 17) {
        return
          verifierPOI16.verifyPOI(
            _args_poi.proof,
            [
              uint256(_args_poi.root),
              uint256(_args_poi.inputNullifiers[0]),
              uint256(_args_poi.inputNullifiers[1]),
              uint256(_args_poi.inputNullifiers[2]),
              uint256(_args_poi.inputNullifiers[3]),
              uint256(_args_poi.inputNullifiers[4]),
              uint256(_args_poi.inputNullifiers[5]),
              uint256(_args_poi.inputNullifiers[6]),
              uint256(_args_poi.inputNullifiers[7]),
              uint256(_args_poi.inputNullifiers[8]),
              uint256(_args_poi.inputNullifiers[9]),
              uint256(_args_poi.inputNullifiers[10]),
              uint256(_args_poi.inputNullifiers[11]),
              uint256(_args_poi.inputNullifiers[12]),
              uint256(_args_poi.inputNullifiers[13]),
              uint256(_args_poi.inputNullifiers[14]),
              uint256(_args_poi.inputNullifiers[15])
          ]
        );
    } else {
      revert("unsupported input count");
    }
  }

}
