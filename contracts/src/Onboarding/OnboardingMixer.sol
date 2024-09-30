// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";   
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./MerkleTreeWithHistoryOnboarding.sol";

interface IVerifier {
  function verifyProof(bytes memory _proof, uint256[2] memory _input) external returns (bool);
}

contract OnboardingMixer is MerkleTreeWithHistory, ReentrancyGuard {

  using SafeERC20 for IERC20;

  uint256 public denomination;

  IVerifier public immutable verifier;

  IERC20 public token;

  // we store all commitments just to prevent accidental deposits with the same commitment

  mapping(bytes32 => bool) public commitments;
  mapping(bytes32 => bool) public nullifierHashes;

  event CommitmentCreated(
    bytes32 indexed commitment,
    uint32 leafIndex,
    uint256 timestamp
  );

  event Withdrawal(
    address to, 
    bytes32 indexed nullifierHash
  );

  event Log(string message);

  constructor(
    IVerifier _verifier,
    IHasher _hasher,
    IERC20 _token,
    uint256 _denomination,
    uint32 _merkleTreeHeight
  ) MerkleTreeWithHistory(_merkleTreeHeight, _hasher) {
    require(_denomination > 0, "denomination should be greater than 0");
    denomination = _denomination;
    verifier = _verifier;
    token = _token;
  }

  function createCommitment(bytes32 _commitment) external nonReentrant{
    require(!commitments[_commitment], "The commitment has been submitted");
    uint32 insertedIndex = _insert(_commitment);
    commitments[_commitment] = true;
    emit CommitmentCreated(_commitment, insertedIndex, block.timestamp);
    token.safeTransferFrom(msg.sender, address(this), denomination);
  }

  function redeemCommitment(  
    bytes calldata _proof,
    bytes32 _root,
    bytes32 _nullifierHash
  ) external payable nonReentrant {
    require(!nullifierHashes[_nullifierHash], "The note has been already spent");
    require(isKnownRoot(_root), "Cannot find your merkle root"); 

    require(
      verifier.verifyProof(
        _proof,
        [uint256(_root), uint256(_nullifierHash)]
      ),
      "Invalid withdraw proof"
    );

    nullifierHashes[_nullifierHash] = true;

    emit Withdrawal(msg.sender, _nullifierHash);

    token.safeTransfer(msg.sender, denomination);

  }

}
