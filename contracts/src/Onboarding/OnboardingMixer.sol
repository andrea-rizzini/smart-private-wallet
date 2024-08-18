// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.12;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./MerkleTreeWithHistoryOnboarding.sol";

interface IVerifier {
  function verifyProof(bytes memory _proof, uint256[2] memory _input) external returns (bool);
}

contract OnboardingMixer is MerkleTreeWithHistory, ReentrancyGuard {

  uint256 public denomination;

  IVerifier public immutable verifier;

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
    uint256 _denomination,
    uint32 _merkleTreeHeight
  ) MerkleTreeWithHistory(_merkleTreeHeight, _hasher) {
    require(_denomination > 0, "denomination should be greater than 0");
    denomination = _denomination;
    verifier = _verifier;
  }

  function _processDeposit() internal {
    require(msg.value == denomination, "Please send the right amount of ETH along with transaction");
  }

  function _processWithdraw(address payable _recipient) internal {
    (bool success, ) = _recipient.call{ value: denomination }("");
    require(success, "payment to _recipient did not go thru");
  }

  function createCommitment(bytes32 _commitment) external payable nonReentrant{
    require(!commitments[_commitment], "The commitment has been submitted");
    uint32 insertedIndex = _insert(_commitment);
    commitments[_commitment] = true;
    _processDeposit();
    emit CommitmentCreated(_commitment, insertedIndex, block.timestamp);
  }

  function redeemCommitment(  
    bytes calldata _proof,
    bytes32 _root,
    bytes32 _nullifierHash,
    address payable _recipient   
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

    _processWithdraw(_recipient);

    emit Withdrawal(_recipient, _nullifierHash);

  }

}
