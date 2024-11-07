// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@account-abstraction/contracts/core/EntryPoint.sol";
import "@account-abstraction/contracts/interfaces/IAccount.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/Create2.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

interface IMixerOnboardingAndTransfers {

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

    function deposit(Proof memory _proofArgs, ExtData memory _extData, bytes32[2] memory commitmentsPOI) external;
    function withdraw(Proof memory _args, ExtData memory _extData, POI memory _poi, bytes32[2] memory commitmentsPOI) external;
    
} 

interface IPoolUsers {
    struct Account_ {
        address owner;
        bytes publicKey;
    }

    function register(Account_ memory _account) external;
}

interface IEncryptedDataOnboardedUsers {
    function addEncryptedData(bytes memory data) external;
}

// Account contract

contract Account is IAccount {

    struct Call {
        address dest;
        uint256 value;
        bytes data;
    }

    address public owner;

    address public usdcToken = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    
    /// The ERC-4337 entry point singleton
    address public entryPoint = 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789;

    event Log(string message);

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
        address recovered = ECDSA.recover(ECDSA.toEthSignedMessageHash(userOpHash), userOp.signature); // here starting from the uerOpHash and its signature, we recover the address of the signer
        return owner == recovered ? 0 : 1; //return 0 if signature is valid, 1 otherwise
    }

    function insertIntoPoolUsers(address poolUsersContract, bytes memory publicKey) public {
        IPoolUsers.Account_ memory account_ = IPoolUsers.Account_({
            owner: address(this),
            publicKey: publicKey
        });

        IPoolUsers(poolUsersContract).register(account_);
    }

    function insertIntoEncryptedData(address contract_address, bytes memory data) public {
        IEncryptedDataOnboardedUsers(contract_address).addEncryptedData(data);
    }

    function callDeposit(
        address poolAddress,
        IMixerOnboardingAndTransfers.Proof memory _proofArgs,
        IMixerOnboardingAndTransfers.ExtData memory _extData,
        bytes32[2] memory commitmentsPOI
    ) external payable {
        uint256 valueToSend = _extData.extAmount > 0 ? uint256(_extData.extAmount) : 0;
        IERC20(usdcToken).approve(poolAddress, valueToSend);
        IMixerOnboardingAndTransfers(poolAddress).deposit(_proofArgs, _extData, commitmentsPOI);
    }

    function callWithdraw(
        address poolAddress,
        IMixerOnboardingAndTransfers.Proof memory _proofArgs,
        IMixerOnboardingAndTransfers.ExtData memory _extData,
        IMixerOnboardingAndTransfers.POI memory _poi,
        bytes32[2] memory commitmentsPOI
    ) external payable {
        IMixerOnboardingAndTransfers(poolAddress).withdraw(_proofArgs, _extData, _poi, commitmentsPOI);
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