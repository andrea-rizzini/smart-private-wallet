// SPDX-License-Identifier: UNLICENSED

import "hardhat/console.sol";

import "@solarity/solidity-lib/libs/data-structures/SparseMerkleTree.sol";

pragma solidity ^0.8.9;

interface IHasherSMT {
  function poseidon(bytes32[2] calldata inputs) external view returns (bytes32);
}

interface IHasherSMT3Inputs {
  function poseidon(bytes32[3] calldata inputs) external view returns (bytes32); // this function must be named "poseidon"
}

contract TestSMT {

    using SparseMerkleTree for SparseMerkleTree.Bytes32SMT;
    SparseMerkleTree.Bytes32SMT internal statusTree;

    IHasherSMT public hasherSMT;
    IHasherSMT3Inputs public hasherSMT3Inputs;

    uint32 _merkleTreesHeight = 32;

    constructor(IHasherSMT _hasherSMT, IHasherSMT3Inputs _hasherSMT3Inputs) {
        hasherSMT = _hasherSMT;
        hasherSMT3Inputs = _hasherSMT3Inputs;
        statusTree.initialize(_merkleTreesHeight);
        statusTree.setHashers(_hash2, _hash3);
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

    function testLog() external pure {
        console.log(1);
    }

    function add (bytes32 _key, bytes32 _value) external {
        statusTree.add(_key, _value);
    }

    function getRoot() external view returns (bytes32) {
        return statusTree.getRoot();
    }

    function getProof(bytes32 _key) external view returns (SparseMerkleTree.Proof memory) {
        return statusTree.getProof(_key);
    }

    function getNode(bytes32 _key) external view returns (SparseMerkleTree.Node memory) {
        return statusTree.getNode(uint256(_key));
    }

    function getNodeByKey(bytes32 _key) external view returns (SparseMerkleTree.Node memory) {
        return statusTree.getNodeByKey(_key);
    }

}