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
        address payable _recipient
    ) external payable;
} 

interface IPoolUsers {
    struct Account_ {
        address owner;
        bytes publicKey;
    }

    function register(Account_ memory _account) external;
}

interface IUTXOsPool {
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

  function transact(Proof memory _args, ExtData memory _extData) external payable;
}

// Account contract

contract Account is IAccount {

    struct Call {
        address dest;
        uint256 value;
        bytes data;
    }

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

    function append_commitment(address contract_address, bytes32 _commitment, uint256 amount) external payable { // amount in wei
        if (amount == 10000000000000000){         
            require(address(this).balance >= 0.01 ether, "Insufficient funds"); 
            IOnboardingMixer(contract_address).createCommitment{value: amount}(_commitment);
        }
        else if (amount == 100000000000000000){
            require(address(this).balance >= 0.1 ether, "Insufficient funds");
            IOnboardingMixer(contract_address).createCommitment{value: amount}(_commitment);
        }
        else if (amount == 1000000000000000000){
            require(address(this).balance >= 1 ether, "Insufficient funds");
            IOnboardingMixer(contract_address).createCommitment{value: amount}(_commitment);
        }
        else if (amount == 1000000000000000000){
            require(address(this).balance >= 10 ether, "Insufficient funds");
            IOnboardingMixer(contract_address).createCommitment{value: amount}(_commitment);
        }
    }

    function redeem_commitment(
        address contract_address,
        bytes calldata _proof,
        bytes32 _root,
        bytes32 _nullifierHash,
        address payable _recipient
    ) external payable {
        IOnboardingMixer(contract_address).redeemCommitment(_proof, _root, _nullifierHash, _recipient);
    }

     function insertIntoPoolUsers(address poolUsersContract, bytes memory publicKey) public {
        IPoolUsers.Account_ memory account_ = IPoolUsers.Account_({
            owner: address(this),
            publicKey: publicKey
        });

        IPoolUsers(poolUsersContract).register(account_);
    }

    function callTransact(
        address poolAddress,
        IUTXOsPool.Proof memory _proofArgs,
        IUTXOsPool.ExtData memory _extData
    ) external payable {
        uint256 valueToSend = _extData.extAmount > 0 ? uint256(_extData.extAmount) : 0;
        IUTXOsPool(poolAddress).transact{value: valueToSend}(_proofArgs, _extData);
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