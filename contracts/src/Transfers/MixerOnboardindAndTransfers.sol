// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";   
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./MerkleTreeWithHistory.sol";
import "./MerkleTreeWithHistoryPOI.sol";
import { IVerifier } from "./interfaces/IVerifier.sol";
import { IVerifierPOI } from "./interfaces/IVerifierPOI.sol";

contract MixerOnboardingAndTransfers is MerkleTreeWithHistory, MerkleTreeWithHistoryPOI, ReentrancyGuard {

  using SafeERC20 for IERC20;

  IERC20 public token;

  // Variable and structures declaration for transactions
  uint256 public maximumDepositAmount = 100 * 10**6; // 100 USDC
  mapping(bytes32 => bool) public nullifierHashes;

  IVerifier public immutable verifier2;
  IVerifier public immutable verifier16;

  IVerifierPOI public immutable verifierPOI2;
  IVerifierPOI public immutable verifierPOI16;

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
  }

  event Log(string message);

  // Events for onboarding
  event CommitmentCreated(
    bytes32 indexed commitment,
    uint32 leafIndex,
    uint256 timestamp
  );

  event Redeemed(
    address to, 
    bytes32 indexed nullifierHash
  );

  // Events for transactions

  event NewCommitment(bytes32 commitment, uint256 index, bytes encryptedOutput);
  event NewCommitmentPOI(bytes32 commitment, uint256 index);
  event NewNullifier(bytes32 nullifier);

  constructor(
    IVerifier _verifier2,
    IVerifier _verifier16,
    IVerifierPOI _verifierPOI2,
    IVerifierPOI _verifierPOI16,
    address _hasherTransactions,
    IERC20 _token,
    uint32 _merkleTreesHeight
  )  MerkleTreeWithHistory(_merkleTreesHeight, _hasherTransactions)
     MerkleTreeWithHistoryPOI(_merkleTreesHeight, _hasherTransactions) {
    verifier2 = _verifier2;
    verifier16 = _verifier16;
    verifierPOI2 = _verifierPOI2;
    verifierPOI16 = _verifierPOI16;
    token = _token;
    super._initialize();
    super._initializePOI();
  }

  function deposit(Proof memory _args, ExtData memory _extData, bytes32[2] memory commitmentsPOI) external payable {
    if (_extData.extAmount > 0) {
      require(uint256(_extData.extAmount) <= maximumDepositAmount, "amount is larger than maximumDepositAmount");
    }
    _deposit(_args, _extData);
    _depositPOI(commitmentsPOI);
  }

  function _deposit(Proof memory _args, ExtData memory _extData) internal nonReentrant {
    require(isKnownRoot_(_args.root), "Invalid merkle root");
    for (uint256 i = 0; i < _args.inputNullifiers.length; i++) {
      require(!isSpent(_args.inputNullifiers[i]), "Input is already spent");
    }
    require(uint256(_args.extDataHash) == uint256(keccak256(abi.encode(_extData))) % FIELD_SIZE_, "Incorrect external data hash");
    require(verifyProof(_args), "Invalid transaction proof");

    for (uint256 i = 0; i < _args.inputNullifiers.length; i++) {
      nullifierHashes[_args.inputNullifiers[i]] = true;
    }

    _insert(_args.outputCommitments[0], _args.outputCommitments[1]);
    emit NewCommitment(_args.outputCommitments[0], nextIndex - 2, _extData.encryptedOutput1);
    emit NewCommitment(_args.outputCommitments[1], nextIndex - 1, _extData.encryptedOutput2);
    for (uint256 i = 0; i < _args.inputNullifiers.length; i++) {
      emit NewNullifier(_args.inputNullifiers[i]);
    }

    token.safeTransferFrom(msg.sender, address(this), uint256(_extData.extAmount));
  }

  function transact(Proof memory _args, ExtData memory _extData, bytes32[2] memory commitmentsPOI) external payable { 
    if (_extData.extAmount > 0) {
      require(uint256(_extData.extAmount) <= maximumDepositAmount, "amount is larger than maximumDepositAmount");
    }
    _transact(_args, _extData);
    _depositPOI(commitmentsPOI); // in future add with delay, to check the funds before append to the tree
  }

  function _transact(Proof memory _args, ExtData memory _extData) internal nonReentrant {
    require(isKnownRoot_(_args.root), "Invalid merkle root");
    for (uint256 i = 0; i < _args.inputNullifiers.length; i++) {
      require(!isSpent(_args.inputNullifiers[i]), "Input is already spent");
    }
    require(uint256(_args.extDataHash) == uint256(keccak256(abi.encode(_extData))) % FIELD_SIZE_, "Incorrect external data hash");
    require(verifyProof(_args), "Invalid transaction proof");

    for (uint256 i = 0; i < _args.inputNullifiers.length; i++) {
      nullifierHashes[_args.inputNullifiers[i]] = true;
    }

    _insert(_args.outputCommitments[0], _args.outputCommitments[1]);
    emit NewCommitment(_args.outputCommitments[0], nextIndex - 2, _extData.encryptedOutput1);
    emit NewCommitment(_args.outputCommitments[1], nextIndex - 1, _extData.encryptedOutput2);
    for (uint256 i = 0; i < _args.inputNullifiers.length; i++) {
      emit NewNullifier(_args.inputNullifiers[i]);
    }
  }

  // function that allows transfers
  function withdraw(Proof memory _args, ExtData memory _extData, POI memory poi, bytes32[2] memory commitmentsPOI) external payable { 
    if (_extData.extAmount > 0) {
      require(uint256(_extData.extAmount) <= maximumDepositAmount, "amount is larger than maximumDepositAmount");
    }
    _withdraw(_args, _extData, poi); 
    _depositPOI(commitmentsPOI); 
  }

  function _withdraw(Proof memory _args, ExtData memory _extData, POI memory poi) internal nonReentrant {
    require(isKnownRoot_(_args.root), "Invalid merkle root");
    require(isKnownRootPOI_(poi.root), "Invalid merkle root POI");

    for (uint256 i = 0; i < _args.inputNullifiers.length; i++) {
      require(!isSpent(_args.inputNullifiers[i]), "Input is already spent");
    }
    require(uint256(_args.extDataHash) == uint256(keccak256(abi.encode(_extData))) % FIELD_SIZE_, "Incorrect external data hash");
    require(verifyProof(_args), "Invalid transaction proof");
    require(verifyPOI(_args, poi), "Invalid POI proof");

    for (uint256 i = 0; i < _args.inputNullifiers.length; i++) {
      nullifierHashes[_args.inputNullifiers[i]] = true;
    }

    if (_extData.extAmount < 0) { // we should always enter here
      require(_extData.recipient != address(0), "Can't withdraw to zero address");
      token.safeTransfer(_extData.recipient, uint256(-_extData.extAmount));
    }

    _insert(_args.outputCommitments[0], _args.outputCommitments[1]);
    emit NewCommitment(_args.outputCommitments[0], nextIndex - 2, _extData.encryptedOutput1);
    emit NewCommitment(_args.outputCommitments[1], nextIndex - 1, _extData.encryptedOutput2);
    for (uint256 i = 0; i < _args.inputNullifiers.length; i++) {
      emit NewNullifier(_args.inputNullifiers[i]);
    }
  }

  function _depositPOI(bytes32[2] memory commitmentsPOI) internal {
    _insertPOI(commitmentsPOI[0], commitmentsPOI[1]);
    emit NewCommitmentPOI(commitmentsPOI[0], nextIndexP - 2);
    emit NewCommitmentPOI(commitmentsPOI[1], nextIndexP - 1);
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
            uint256(_args.extDataHash),
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
            uint256(_args.extDataHash),
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

  function verifyPOI(Proof memory _args, POI memory poi) public view returns (bool) {
    if (_args.inputNullifiers.length == 2) {
      return verifierPOI2.verifyPOI2(poi.proof, [uint256(poi.root)]);
    } else if (_args.inputNullifiers.length == 16) {
      return verifierPOI16.verifyPOI16(poi.proof, [uint256(poi.root)]);
    } else {
      revert("unsupported input count");
    }
  }

}