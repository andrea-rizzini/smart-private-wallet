// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.12;

contract AssociationSet {
    bytes32[] public commitments;

    event CommitmentAdded(bytes32 commitment);

    function addToTheAssociationSet(bytes32[2] calldata _commitment) external {
        commitments.push(_commitment[0]);
        commitments.push(_commitment[1]);
        emit CommitmentAdded(_commitment[0]);
        emit CommitmentAdded(_commitment[1]);
    }
}