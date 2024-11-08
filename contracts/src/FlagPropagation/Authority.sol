// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.12;

import "@account-abstraction/contracts/core/EntryPoint.sol";
import "@account-abstraction/contracts/interfaces/IAccount.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/Create2.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

interface IMixerOnboardingAndTransfers {

    // function insertMaskedCommitment(bytes32 maskedCommitment, bytes32 allowance) external;

    function flagStatus(bytes calldata maskProof, bytes32 maskedCommitment) external;
} 

contract Authority is IAccount {

    address public owner;

    constructor(address _owner) {
        owner = _owner;
    }
 
    function validateUserOp(UserOperation calldata userOp, bytes32 userOpHash, uint256) external view returns (uint256 validationData) 
    {
        address recovered = ECDSA.recover(ECDSA.toEthSignedMessageHash(userOpHash), userOp.signature); 
        return owner == recovered ? 0 : 1; 
    }

    function callFlagStatus(address poolAddress, bytes calldata maskProof, bytes32 maskedCommitment) external {
        IMixerOnboardingAndTransfers(poolAddress).flagStatus(maskProof, maskedCommitment);
    }

}

contract AccountFactory {
    function createAccount(address owner) external returns (address) {

        bytes32 salt = bytes32(uint256(uint160(owner)));
        bytes memory bytecode = abi.encodePacked(type(Authority).creationCode, abi.encode(owner));

        address addr = Create2.computeAddress(salt, keccak256(bytecode));
        uint256 codeSize = addr.code.length;
        if (codeSize > 0) {
            return addr;
        }

        return deploy(salt, bytecode);
    }

    function deploy(bytes32 salt, bytes memory bytecode) internal returns (address addr) {
        require(bytecode.length != 0, "Create2: bytecode length is zero");
        assembly {
            addr := create2(0, add(bytecode, 0x20), mload(bytecode), salt)
        }
        require(addr != address(0), "Create2: Failed on deploy");
    }
    
}