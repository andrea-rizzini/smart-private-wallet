// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";   
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@solarity/solidity-lib/libs/data-structures/SparseMerkleTree.sol";
import "../Transfers/MerkleTreeWithHistory.sol";
import { IVerifier } from "../Transfers/interfaces/IVerifier.sol";
import { IVerifierMaskedCommitment } from "../FlagPropagation/IVerifierMaskedCommitment.sol";
import { IVerifierNonMembershipBloom } from "./IVerifierNonMembershipBloom.sol";

interface IHasherSMT {
  function poseidon(bytes32[2] calldata inputs) external view returns (bytes32);
}

interface IHasherSMT3Inputs {
  function poseidon(bytes32[3] calldata inputs) external view returns (bytes32); // this function must be named "poseidon"
}

contract MixerOnboardingAndTransfers is MerkleTreeWithHistory, ReentrancyGuard {

  using SafeERC20 for IERC20;
  using SparseMerkleTree for SparseMerkleTree.Bytes32SMT;

  IHasherSMT public hasherSMT;
  IHasherSMT3Inputs public hasherSMT3Inputs;
  IERC20 public token;

  // Variable and structures declaration for transactions
  uint256 public maximumDepositAmount = 100 * 10**6; // 100 USDC
  mapping(bytes32 => bool) public nullifierHashes;

  IVerifier public immutable verifier2;
  IVerifier public immutable verifier16;

  IVerifierMaskedCommitment public immutable verifierMaskedCommitment;

  IVerifierNonMembershipBloom public immutable verifierNonMembershipBloom;

  //MerkleTreeWithHistory public statusTree;
  SparseMerkleTree.Bytes32SMT internal statusTree;

  address public authority;

  struct ExtData {
    address recipient;
    int256 extAmount;
    bytes encryptedOutput1;
    bytes encryptedOutput2;
    bytes encryptedChainState1;
    bytes encryptedChainState2;
  } 

  struct Proof {
    bytes proof;
    bytes32 root;
    bytes32[] inputNullifiers;
    bytes32[2] outputCommitments;
    uint256 publicAmount;
    bytes32 extDataHash;
  }

  struct ProofBloom {
    bytes[] proofs;
    bytes32 root;
    uint256[] keys;
    uint32 isExclusion;
    uint32 k;
  }

  // Events for transactions

  event NewCommitmentV2(bytes32 commitment, uint256 index, bytes encryptedOutput, bytes encryptedChainState);
  event NewNullifier(bytes32 nullifier);

  event StatusFlagged(uint256 index, bytes32 bloomMaskedCommitment, bool status, uint256 timestamp, bytes32 newRoot);

  modifier onlyAuthority() {
      require(msg.sender == authority, "Not authorized");
      _;
  }

  constructor(
    IVerifier _verifier2,
    IVerifier _verifier16,
    IVerifierMaskedCommitment _verifierMaskedCommitment,
    IVerifierNonMembershipBloom _verifierNonMembershipBloom,
    address _hasherTransactions,
    address _hasherPoseidon3Inputs,
    IERC20 _token,
    uint32 _merkleTreesHeight,
    address _authority
  )  MerkleTreeWithHistory(_merkleTreesHeight, _hasherTransactions) {
    verifier2 = _verifier2;
    verifier16 = _verifier16;
    verifierMaskedCommitment = _verifierMaskedCommitment;
    verifierNonMembershipBloom = _verifierNonMembershipBloom;
    hasherSMT = IHasherSMT(_hasherTransactions);
    hasherSMT3Inputs = IHasherSMT3Inputs(_hasherPoseidon3Inputs);
    token = _token;
    authority = _authority;
    statusTree.initialize(_merkleTreesHeight);
    statusTree.setHashers(_hash2, _hash3);
    super._initialize();
  }

  function _hash2(bytes32 element1_, bytes32 element2_) internal view returns (bytes32) {
    return bytes32(hasherSMT.poseidon([element1_, element2_]));
  }

  function _hash3(
      bytes32 element1_,
      bytes32 element2_,
      bytes32 element3_
  ) internal view returns (bytes32) {
      return bytes32(hasherSMT3Inputs.poseidon([element1_, element2_, element3_]));
  }


  function getRootSMT() public view returns (bytes32) {
    return statusTree.getRoot();
  }

  function flagStatus(
      bytes calldata maskProof,
      uint256 index,
      bytes32 bloomMaskedCommitment
  ) external onlyAuthority {
    require(verifyMaskProof(maskProof, bloomMaskedCommitment), "Invalid mask proof");
    
    statusTree.add(bytes32(index), bloomMaskedCommitment);
    bytes32 newRoot = statusTree.getRoot();

    emit StatusFlagged(
        uint256(index),
        bloomMaskedCommitment,
        true,
        block.timestamp,
        newRoot
    );
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
    emit NewCommitmentV2(_args.outputCommitments[0], nextIndex - 2, _extData.encryptedOutput1, _extData.encryptedChainState1);
    emit NewCommitmentV2(_args.outputCommitments[1], nextIndex - 1, _extData.encryptedOutput2, _extData.encryptedChainState2);
    for (uint256 i = 0; i < _args.inputNullifiers.length; i++) {
      emit NewNullifier(_args.inputNullifiers[i]);
    }

    token.safeTransferFrom(msg.sender, address(this), uint256(_extData.extAmount));
  }

  function transact(Proof memory _args, bytes memory _proofBloom, uint256[3] memory _publicSignalsBloom, ExtData memory _extData) external payable { 
    if (_extData.extAmount > 0) {
      require(uint256(_extData.extAmount) <= maximumDepositAmount, "amount is larger than maximumDepositAmount");
    }
    _transact(_args, _proofBloom, _publicSignalsBloom, _extData);
  }

  function _transact(Proof memory _args, bytes memory _proofBloom, uint256[3] memory _publicSignalsBloom, ExtData memory _extData) internal nonReentrant {
    require(isKnownRoot_(_args.root), "Invalid merkle root"); // the root I'm generating locally has to be among the last 100 roots viewed by the contract
    for (uint256 i = 0; i < _args.inputNullifiers.length; i++) {
      require(!isSpent(_args.inputNullifiers[i]), "Input is already spent");
    }
    require(uint256(_args.extDataHash) == uint256(keccak256(abi.encode(_extData))) % FIELD_SIZE_, "Incorrect external data hash");

    // a check for the smt root needs to be added here
    require(verifyProofsBloom(_proofBloom, _publicSignalsBloom), "Invalid bloom proof");
    require(verifyProof(_args), "Invalid transaction proof");

    for (uint256 i = 0; i < _args.inputNullifiers.length; i++) {
      nullifierHashes[_args.inputNullifiers[i]] = true;
    }

    _insert(_args.outputCommitments[0], _args.outputCommitments[1]);
    emit NewCommitmentV2(_args.outputCommitments[0], nextIndex - 2, _extData.encryptedOutput1, _extData.encryptedChainState1);
    emit NewCommitmentV2(_args.outputCommitments[1], nextIndex - 1, _extData.encryptedOutput2, _extData.encryptedChainState2);
    for (uint256 i = 0; i < _args.inputNullifiers.length; i++) {
      emit NewNullifier(_args.inputNullifiers[i]);
    }
  }

  // function that allows transfers
  function withdraw(Proof memory _args, bytes memory _proofBloom, uint256[3] memory _publicSignalsBloom, ExtData memory _extData) external payable { 
    if (_extData.extAmount > 0) {
      require(uint256(_extData.extAmount) <= maximumDepositAmount, "amount is larger than maximumDepositAmount");
    }
    _withdraw(_args, _proofBloom, _publicSignalsBloom, _extData); 
  }

  function _withdraw(Proof memory _args, bytes memory _proofBloom, uint256[3] memory _publicSignalsBloom, ExtData memory _extData) internal nonReentrant {
    require(isKnownRoot_(_args.root), "Invalid merkle root");

    for (uint256 i = 0; i < _args.inputNullifiers.length; i++) {
      require(!isSpent(_args.inputNullifiers[i]), "Input is already spent");
    }
    require(uint256(_args.extDataHash) == uint256(keccak256(abi.encode(_extData))) % FIELD_SIZE_, "Incorrect external data hash");

    require(verifyProofsBloom(_proofBloom, _publicSignalsBloom), "Invalid bloom proof");
    require(verifyProof(_args), "Invalid transaction proof");

    for (uint256 i = 0; i < _args.inputNullifiers.length; i++) {
      nullifierHashes[_args.inputNullifiers[i]] = true;
    }

    if (_extData.extAmount < 0) { // we should always enter here
      require(_extData.recipient != address(0), "Can't withdraw to zero address");
      token.safeTransfer(_extData.recipient, uint256(-_extData.extAmount));require(verifyProof(_args), "Invalid transaction proof");
    }

    _insert(_args.outputCommitments[0], _args.outputCommitments[1]);
    emit NewCommitmentV2(_args.outputCommitments[0], nextIndex - 2, _extData.encryptedOutput1, _extData.encryptedChainState1);
    emit NewCommitmentV2(_args.outputCommitments[1], nextIndex - 1, _extData.encryptedOutput2, _extData.encryptedChainState2);
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

  function verifyMaskProof(bytes memory maskProof, bytes32 maskedCommitment) public view returns (bool) {
    return verifierMaskedCommitment.verifyProofMaskCommitment(maskProof, [uint256(maskedCommitment)]);
  }

  function verifyProofsBloom(bytes memory _proofBloom, uint256[3] memory _publicSignalsBloom) public view returns (bool) {

    return verifierNonMembershipBloom.verifyProofBloom(_proofBloom, _publicSignalsBloom);
  }
}