// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

contract EncryptedDataOnboardedUsers {

    event EncryptedData(bytes encryptedNameAndAddress);

    function register(bytes memory data) public {
        emit EncryptedData(data);
    }

}