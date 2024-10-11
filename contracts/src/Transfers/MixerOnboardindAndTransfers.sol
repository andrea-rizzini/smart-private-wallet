// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";   
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../Onboarding/MerkleTreeWithHistoryOnboarding.sol";
import "./MerkleTreeWithHistoryTransactions.sol";
import { IVerifier } from "./interfaces/IVerifier.sol";

interface IVerifierOnboarding {
  function verifyProof(bytes memory _proof, uint256[2] memory _input) external returns (bool);
}

contract MixerOnboardingAndTransfers is MerkleTreeWithHistoryOnboarding, MerkleTreeWithHistoryTransactions, ReentrancyGuard {

  using SafeERC20 for IERC20;

  IERC20 public token;

  // Variable declaration for onboarding
  IVerifierOnboarding public immutable verifierOnboarding;

  mapping(bytes32 => bool) public commitments;
  mapping(bytes32 => bool) public nullifierHashes;

  // Variable and structures declaration for transactions
  uint256 public maximumDepositAmount = 100 * 10**6; // 100 USDC
  mapping(bytes32 => bool) public nullifierHashesTransfers;

  IVerifier public immutable verifier2;
  IVerifier public immutable verifier16;

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
  event NewNullifier(bytes32 nullifier);

  constructor(
    IVerifierOnboarding _verifierOnboarding,
    IVerifier _verifier2,
    IVerifier _verifier16,
    IHasherOnboarding _hasherOnboarding,
    address _hasherTransactions,
    IERC20 _token,
    uint32 _merkleTreeHeightOnboarding,
    uint32 _merkleTreeHeightTransactions
  ) MerkleTreeWithHistoryOnboarding(_merkleTreeHeightOnboarding, _hasherOnboarding) 
    MerkleTreeWithHistoryTransactions(_merkleTreeHeightTransactions, _hasherTransactions) {
    verifierOnboarding = _verifierOnboarding;
    verifier2 = _verifier2;
    verifier16 = _verifier16;
    token = _token;
    super._initialize();
  }

  // Functions for onboarding
  function createCommitment(bytes32 _commitment, uint256 extAmount) external nonReentrant{
    require(!commitments[_commitment], "The commitment has been submitted");
    uint32 insertedIndex = _insert(_commitment);
    commitments[_commitment] = true;
    emit CommitmentCreated(_commitment, insertedIndex, block.timestamp);
    token.safeTransferFrom(msg.sender, address(this), /*denomination*/ extAmount);
  }

  function redeemCommitment(  
    bytes calldata _proof,
    bytes32 _root,
    bytes32 _nullifierHash,
    Proof memory _args, 
    ExtData memory _extData
  ) external payable nonReentrant {
    require(!nullifierHashes[_nullifierHash], "The note has been already spent");
    require(isKnownRoot(_root), "Cannot find your merkle root"); 

    require(
      verifierOnboarding.verifyProof(
        _proof,
        [uint256(_root), uint256(_nullifierHash)]
      ),
      "Invalid withdraw proof"
    );

    _deposit_after_redeem(_args, _extData);

    nullifierHashes[_nullifierHash] = true;

    emit Redeemed(msg.sender, _nullifierHash);

  }

  // Functions for transactions

  function _deposit_after_redeem(Proof memory _args, ExtData memory _extData) internal {
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

  function deposit(Proof memory _args, ExtData memory _extData) external payable { 
    if (_extData.extAmount > 0) {
      require(uint256(_extData.extAmount) <= maximumDepositAmount, "amount is larger than maximumDepositAmount");
    }
    _deposit(_args, _extData);
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

  // function that allows deposits, transfers and withdrawal.
  function transact(Proof memory _args, ExtData memory _extData) external payable { 
    if (_extData.extAmount > 0) {
      require(uint256(_extData.extAmount) <= maximumDepositAmount, "amount is larger than maximumDepositAmount");
    }
    _transact(_args, _extData);
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

    if (_extData.extAmount < 0) { // we enter here only if the operation is a withdrawal
      require(_extData.recipient != address(0), "Can't withdraw to zero address");
      token.safeTransfer(msg.sender, uint256(-_extData.extAmount));
    }

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

}
