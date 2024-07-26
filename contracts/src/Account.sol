// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.12;

import "@account-abstraction/contracts/core/EntryPoint.sol";
import "@account-abstraction/contracts/interfaces/IAccount.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/Create2.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

interface IOnboardingMixer {
    function createCommitment(bytes32 _commitment) external payable;
    function redeemCommitment(    
        bytes calldata _proof,
        bytes32 _root,
        bytes32 _nullifierHash,
        address payable _recipient,
        address payable _relayer,
        uint256 _fee,
        uint256 _refund
    ) external payable;
} 

// Account contract

contract Account is IAccount {

    struct Call {
        address dest;
        uint256 value;
        bytes data;
    }

    uint public counter;
    address public owner;
    
    /// The ERC-4337 entry point singleton
    address public entryPoint = 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789;

    modifier onlyEntryPoint() {
        require(msg.sender == address(entryPoint), "only entry point");
        _;
    }

    constructor(address _owner) {
        owner = _owner;
    }

    receive() external payable {}

    function validateUserOp(UserOperation calldata userOp, bytes32 userOpHash, uint256) external view returns (uint256 validationData) 
    {
        address recovered = ECDSA.recover(ECDSA.toEthSignedMessageHash(userOpHash), userOp.signature);
        return owner == recovered ? 0 : 1; //return 0 if signature is valid, 1 otherwise
    }

    function append_commitment(address contract_address, bytes32 _commitment, uint32 flag) external payable {
        if (flag == 1){
            require(address(this).balance >= 0.01 ether, "Insufficient funds"); 
            IOnboardingMixer(contract_address).createCommitment{value: 0.01 ether}(_commitment);
        }
        else if (flag == 2){
            require(address(this).balance >= 0.1 ether, "Insufficient funds");
            IOnboardingMixer(contract_address).createCommitment{value: 0.1 ether}(_commitment);
        }
        else if (flag == 3){
            require(address(this).balance >= 1 ether, "Insufficient funds");
            IOnboardingMixer(contract_address).createCommitment{value: 1 ether}(_commitment);
        }
        else if (flag == 4){
            require(address(this).balance >= 10 ether, "Insufficient funds");
            IOnboardingMixer(contract_address).createCommitment{value: 10 ether}(_commitment);
        }
    }

    function redeem_commitment(
        address contract_address,
        bytes calldata _proof,
        bytes32 _root,
        bytes32 _nullifierHash,
        address payable _recipient,
        address payable _relayer,
        uint256 _fee,
        uint256 _refund
    ) external payable {
        IOnboardingMixer(contract_address).redeemCommitment(_proof, _root, _nullifierHash, _recipient, _relayer, _fee, _refund);
    }

    function test () external {
        counter++;
    }
    
}

contract AccountFactory {
    function createAccount(address owner) external returns (address) {

        bytes32 salt = bytes32(uint256(uint160(owner)));
        bytes memory bytecode = abi.encodePacked(type(Account).creationCode, abi.encode(owner));

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