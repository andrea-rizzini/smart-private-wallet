import fs from 'fs';
import hre from "hardhat";
import path from 'path';
import * as readline from 'readline';

import { call_userop } from "./userop/createUserOp";
import { createNote } from "./note/createNote";
import { getAccountAddress, getTotalAmount } from "./pool/poolFunctions";
import { getAddressOfContactOfUser, getContactsByUserId, getID, getUnredeemedNullifiersByUserId, insertContact, insertKeypair, insertUserNullifier, 
    updateContact, updateNullifierRedeemed } from '../database/database';
import { inputFromCLI } from "./utils/inputFromCLI";
import { Keypair } from "./pool/keypair";
import { LinkNote, USDCStr } from "./types/link";
import { prepareDeposit, prepareTransfer, prepareTransferForOnboarding, prepareWithdrawal } from "./pool/poolPrepareActions";
import { Utxo } from "./pool/utxo";

const INIT_CODE_RELAYER = process.env.INIT_CODE_RELAYER || '';
const MIXER_ONBOARDING_AND_TRANSFERS = process.env.MIXER_ONBOARDING_AND_TRANSFERS || '';
const POOL_USERS_ADDRESS = process.env.POOL_USERS_ADDRESS || '';
const RELAYER_ADDRESS = process.env.RELAYER_ADDRESS || '';
const USDC_ADDRESS: string = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'

export async function setup(username: string, account: string, initCode: string, signer: any) {

    const poolAddress = await getAccountAddress(account);

    if (poolAddress) {
        console.log("\nAlready registered!\n")
    }
    else {
        const keypair = new Keypair(); 

        const output = new Utxo({ keypair })

        // register in poolUsers
        await call_userop("Account", "insertIntoPoolUsers", [POOL_USERS_ADDRESS, output.keypair.address()], account , initCode, signer);

        const index = getID(username);

        insertKeypair(index, keypair.privkey, keypair.pubkey.toString(), keypair.encryptionKey);

        // console.log("\nRegistered successfully!\n")
    }
}

export async function checkAccountBalance(username: string, account: string) {
    console.log("\nChecking account balance ...");
    
    console.log("\nAddress:", account);

    try {
        const poolAmount = await getTotalAmount(username, account);
        const poolAmountFormatted = Number(poolAmount) / (10 ** 6);
        console.log(`\nPrivate account balance: ${poolAmountFormatted.toString()} USDC\n`, );
    } catch (error) {
        console.error("\nCannot show private amount, user not yet registered in the pool\n");
    }
    
}

export async function inviteUsingLink(name: string, account: string, initCode: string, signer: any) {

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

    // 1) chose the name and the amount

    const nameOnbUser: string = await inputFromCLI("\nEnter the name of the invited user to be added on your contacts: ", rl);

    // let choice: string;
    let choiceAmount: string;
    let isValid: boolean = false; 

    const poolAmount = await getTotalAmount(name, account);

    do {
        choiceAmount = await inputFromCLI("\nInsert the amount (or type exit to return to the menu): ", rl);

        const parsedAmount = parseFloat(choiceAmount);

        if (!isNaN(parsedAmount) && parsedAmount > 0 && Number(poolAmount) >= hre.ethers.parseUnits(choiceAmount, 6)) {
            isValid = true;
        }
        else if (choiceAmount === 'exit') {
            console.log("\n");
            isValid = true;
            rl.close();
            return;
        }
        else {
            console.log("\nInvalid amount. Please enter a valid number.");
        }
    } while (!isValid);

    let usdcValue: USDCStr = `${parseFloat(choiceAmount)}` as USDCStr;
    let id: string = MIXER_ONBOARDING_AND_TRANSFERS;

    // 2) create the utxo 
    const result = await prepareTransferForOnboarding(choiceAmount, account, account, signer);

    // if (result) {
    //     const signers = await hre.ethers.getSigners();
    //     const { args, extData } = result;
    //     try {
    //         await call_userop("contracts/src/Transfers/Relayer.sol:Relayer", "callTransact", [MIXER_ONBOARDING_AND_TRANSFERS, args, extData], RELAYER_ADDRESS , INIT_CODE_RELAYER, signers[3]); 
    //         console.log(`\nTransfer of ${choiceAmount} USDC completed succesfully!\n`);
    //     }
    //     catch (error) {
    //         console.error("\nSomething went wrong during the transfer transaction:", error);
    //         console.log("\n");
    //     }
        
    // }
    // else {
    //     console.log("\nTransfer preparation failed\n");
    // }

    const link: LinkNote = {
        type: "notev1",
        symmetric_key: "0x",
        sender: name,
        sender_address: account,
        recevier: nameOnbUser,
        usdc: usdcValue, // arbitrary denomination
        id: id // address of the onboarding mixer contract
    };

    // 3) append the commitment to the mixer contract

    const code = await hre.ethers.provider.getCode(account); // get the bytecode of the smart account
    if (code !== "0x") {
      initCode = "0x";
    }

    const signers = await hre.ethers.getSigners();
    const faucet = signers[2];

    const usdcAmount = hre.ethers.parseUnits(usdcValue, 6)

    await call_userop("Account", "appendCommitmentV2", [id, commitmentHex, usdcAmount], account , initCode, signer);

    // 4) send the link to the invited user

    console.log(`\nSending link via whatsapp to ${nameOnbUser} ... [simulated]`);
    console.log("\nSending: \n")
    console.log(link);
    console.log("\n");

    let jsonString = JSON.stringify(link, null, 2);
    let dirPath = path.join(__dirname, '../links/');
    let filePath = path.join(dirPath, 'linkNote.json');

    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }

    fs.writeFileSync(filePath, jsonString);

    // 5) append the OnbUser to the contacts table of the sender and append <nameOnbUser, nullifierHex, amount, redeemed> to the nullifiers table
    
    insertContact(getID(name), nameOnbUser, "0x");

    insertUserNullifier(getID(name), nameOnbUser, nullifierHex, Number(usdcValue)); // default to redeemed = false

}

export async function send(username: string, account: string, initCode: string, signer: any) {
    console.log("\nYou can send utxos with arbitrary denomination !");

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    let choiceAmount: string;
    let amountValid: boolean = false;

    do {
        choiceAmount = await inputFromCLI("\nInsert the amount (or type exit to return to the menu): ", rl);

        const parsedAmount = parseFloat(choiceAmount);

        if (!isNaN(parsedAmount) && parsedAmount > 0 ) {
            amountValid = true;
        }
        else if (choiceAmount === 'exit') {
            console.log("\n");
            amountValid = true;
            rl.close();
            return;
        }
        else {
            console.log("\nInvalid amount. Please enter a valid number.");
        }
    } while (!amountValid);

    const optionsForReceiver = ['\n[1] Insert the receiver name from you contacts', '[2] Insert an address directly', '[3] Return to the menu'];

    for (let i = 0; i < optionsForReceiver.length; i++) {
        console.log(optionsForReceiver[i]);
    }

    let choice: string;
    let isValid: boolean = false;   

    do {
        console.log('\nChose an option:')
        choice = await inputFromCLI(": ", rl);
        if (choice === '1' || choice === '2') {
            isValid = true;
        }
        else if (choice === '3') {
            isValid = true;
            rl.close();
            return;
        }
        else {
            console.log('\nInvalid input.');
        }
    } while (!isValid);

    let addressReceiver: string = "0x";
    isValid = false;   

    if (choice === '1') {
        let contactName: string;
        
        try {
            do {
                contactName = await inputFromCLI("\nInsert the name of the receiver (or type exit to return to the menu): ", rl);
                const address = getAddressOfContactOfUser(getID(username), contactName);
                if (address) {
                    addressReceiver = address as string; 
                    isValid = true;
                } 
                else if (contactName === 'exit') {
                    console.log("\n");
                    isValid = true;
                    rl.close();
                    return;
                }
                else {
                    console.log('\nNot in your contacts.\n');
                }
            } while (!isValid);
        }
        catch (error) {
            console.error(`\nNo contacts present in the address book\n`);
        }       

    }
    else if (choice === '2') {
        addressReceiver = await inputFromCLI("\nInsert the address (or type exit to return to the menu): ", rl);
        if (addressReceiver === 'exit') {
            console.log("\n");
            rl.close();
            return;
        }
    }

    const result = await prepareTransfer(choiceAmount, username, account, addressReceiver, signer);

    if (result) {
        const signers = await hre.ethers.getSigners();
        const { args, extData } = result;
        try {
            await call_userop("contracts/src/Transfers/Relayer.sol:Relayer", "callTransact", [MIXER_ONBOARDING_AND_TRANSFERS, args, extData], RELAYER_ADDRESS , INIT_CODE_RELAYER, signers[3]); 
            console.log(`\nTransfer of ${choiceAmount} USDC completed succesfully!\n`);
        }
        catch (error) {
            console.error("\nSomething went wrong during the transfer transaction:", error);
            console.log("\n");
        }
        
    }
    else {
        console.log("\nTransfer preparation failed\n");
    }
    
    rl.close();

}

export async function receive(signer: any, account: string, initCode: string) {

    // we can choose wether fund the public amount (needed to onboard people) or add a new utxo to fund the private amount

    console.log("\nThrough this page you can fund the the private amount from an externall wallet.");

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    let choiceAmount: string;
    let amountValid: boolean = false;

    do {
        choiceAmount = await inputFromCLI("\nInsert the amount (or type exit to return to the menu): ", rl);

        const parsedAmount = parseFloat(choiceAmount);

        if (!isNaN(parsedAmount) && parsedAmount > 0) {
            amountValid = true;
        }
        else if (choiceAmount === 'exit') {
            console.log("\n");
            amountValid = true;
            rl.close();
            return;
        } 
        else {
            console.log("\nInvalid amount. Please enter a valid number.");
        }
    } while (!amountValid);

    rl.close();

    const usdc = await hre.ethers.getContractAt("IERC20", USDC_ADDRESS, signer);
    const usdcAmount = hre.ethers.parseUnits(choiceAmount, 6);
  
    await usdc.approve(account, usdcAmount);
  
    const transferTx = await usdc.transfer(account, usdcAmount);
    await transferTx.wait();

    // add a new utxo with that value
    const result = await prepareDeposit(choiceAmount, account, signer);
    if (result) {
        const { args, extData } = result;
        try {
            await call_userop("Account", "callDeposit", [MIXER_ONBOARDING_AND_TRANSFERS, args, extData], account , initCode, signer);
            console.log(`\nFunded private amount with ${choiceAmount} USDC\n`)
        }
        catch (error) {
            console.error("\nSomething went wrong during the deposit transaction:", error);
            console.log("\n");
        }
    }
    else {
        console.log("\nDeposit preparation failed\n");
        
        }   
    
}

export async function refresh(username: string) {
    console.log('\nRefreshing ...');
    console.log('\n');

    let unredeemedNullifiers: any;

    try {
        unredeemedNullifiers = getUnredeemedNullifiersByUserId(getID(username));
    } catch (error) {
        unredeemedNullifiers = [];
        console.error(`Error during refresh:`, error);
    }

    for (let i = 0; i < unredeemedNullifiers.length; i++) {
        const name = unredeemedNullifiers[i].name;
        const nullifierHash = unredeemedNullifiers[i].nullifier;
        let contractAddress = "0x";

        contractAddress = MIXER_ONBOARDING_AND_TRANSFERS;

        // fetching Withdrawal events from the mixer contract
        const contract = await hre.ethers.getContractAt("MixerOnboardingAndTransfers", contractAddress);
        const filter = contract.filters.Redeemed();
        const events = await contract.queryFilter(filter);
        events.forEach(event => {
            if (event.args.nullifierHash === nullifierHash) {

                updateNullifierRedeemed(getID(username), nullifierHash);
                updateContact(getID(username), name, event.args.to);           
            }
        });
    }  
}

export async function showContacts(name: string) {

    const contacts = getContactsByUserId(getID(name));

    if (contacts.length === 0) {
        console.log("\nNo contacts present in the address book\n");
        return;
    }
    else {
        console.log("\nContacts:\n");
        console.log(contacts);
    }

    console.log("\n");
 }

 export async function withdraw(username: string, account: string, initCode: string, signer: any) {
    console.log("\nYou can withdraw utxos with arbitrary denomination !");
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    let choiceAmount: string;
    let amountValid: boolean = false;

    do {
        choiceAmount = await inputFromCLI("\nInsert the amount (or type exit to return to the menu): ", rl);

        const parsedAmount = parseFloat(choiceAmount);

        if (!isNaN(parsedAmount) && parsedAmount > 0) {
            amountValid = true;
        }
        else if (choiceAmount === 'exit') {
            console.log("\n");
            amountValid = true;
            rl.close();
            return;
        } 
        else {
            console.log("\nInvalid amount. Please enter a valid number.");
        }
    } while (!amountValid);

    rl.close();
    const result = await prepareWithdrawal(choiceAmount, username, account, signer);
    if (result) {
        const { args, extData } = result;
        try {
            await call_userop("Accpunt", "callTransact", [MIXER_ONBOARDING_AND_TRANSFERS, args, extData], account , initCode, signer);
            console.log(`\nWithdrawal of ${choiceAmount} USDC completed succesfully!\n`);
        }
        catch (error) {
            console.error("\nSomething went wrong during the withdrawal transaction:", error);
            console.log("\n");
        }   
    }
    else {
        console.log("\nWithdraw preparation failed");
    } 
 }

export async function exit(name: string) {
    console.log('\nExiting ...');

    process.exit(0);

}