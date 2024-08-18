// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

contract PoolUsers {

    event PublicKey(address indexed owner, bytes key);

    struct Account {
        address owner;
        bytes publicKey;
    }

    function register(Account memory _account) public {
        require(_account.owner == msg.sender, "only owner can be registered"); // this avoids impersonation
        _register(_account);
    }

    function _register(Account memory _account) internal {
        emit PublicKey(_account.owner, _account.publicKey);
    }

}