import fs from 'fs';
import hre from "hardhat";
import path from 'path';
import * as readline from 'readline';

import { call_userop } from "./userop/createUserOp";
import { createNote } from "./note/createNote";
import { checkSanctionedAddress } from "./poi/checkIfSanctioned";
import { CommitmentEvents, GeneratePOIParams } from './pool/types';
import { fetchCommitments } from './pool/poolFunctions';
import { generatePOI } from './poi/generatePOI';
import { getAccountAddress, getTotalAmount } from "./pool/poolFunctions";
import { getAddressOfContactOfUser, getContactsByUserId, getID, getUnredeemedNullifiersByUserId, insertContact, insertKeypair, insertUserNullifier, 
    updateContact, updateNullifierRedeemed } from '../database/database';
import { inputFromCLI } from "./utils/inputFromCLI";
import { Keypair } from "./pool/keypair";
import { LinkNote, EthersStr } from "./types/link";
import { prepareDeposit, prepareTransfer, prepareWithdrawal } from "./pool/poolPrepareActions";
import { Utxo } from "./pool/utxo";

const INIT_CODE_RELAYER_V3 = process.env.INIT_CODE_RELAYER_V3 || '';
const ONBOARDING_MIXER_ADDRESS_TEST = process.env.ONBOARDING_MIXER_ADDRESS_TEST || '';
const ONBOARDING_MIXER_ADDRESS_LOW = process.env.ONBOARDING_MIXER_ADDRESS_LOW || '';
const ONBOARDING_MIXER_ADDRESS_MEDIUM = process.env.ONBOARDING_MIXER_ADDRESS_MEDIUM || '';
const ONBOARDING_MIXER_ADDRESS_HIGH = process.env.ONBOARDING_MIXER_ADDRESS_HIGH || '';
const POOL_USERS_ADDRESS = process.env.POOL_USERS_ADDRESS || '';
const RELAYER_V3_ADDRESS = process.env.RELAYER_V3_ADDRESS || '';
const UTXOS_POOL_ADDRESS_WITH_COMPLIANCE = process.env.UTXOS_POOL_ADDRESS_WITH_COMPLIANCE || '';

export async function setup(username: string, account: string, initCode: string, signer: any) {

    const poolAddress = await getAccountAddress(account);

    if (poolAddress) {
        console.log("\nAlready registered!\n")
    }
    else {
        const keypair = new Keypair(); 

        const output = new Utxo({ keypair })

        // register in poolUsers
        await call_userop("insertIntoPoolUsers", [POOL_USERS_ADDRESS, output.keypair.address()], account , initCode, signer);

        const index = getID(username);

        insertKeypair(index, keypair.privkey, keypair.pubkey.toString(), keypair.encryptionKey);

        console.log("\nRegistered successfully!\n")
    }
}

export async function checkAccountBalance(username: string, account: string) {
    console.log("\nChecking account balance ...");
    
    console.log("\nAddress:", account);

    const publicAmount = await hre.ethers.provider.getBalance(account);
    console.log("\nPublic account balance in wei:", publicAmount.toString()); // .toString() to avoid publicAmount print ending with 'n'
    console.log("Public account balance in eth: ", Number(publicAmount) / Number(BigInt("1000000000000000000")))
    
    try {
        const poolAmount = await getTotalAmount(username, account);
        console.log("\nPrivate account balance in wei:", poolAmount.toString());
        console.log("Private account balance in eth: ", Number(poolAmount) / Number(BigInt("1000000000000000000")))
        console.log("\n");
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

    console.log("\nchoose the amount to send for onboarding:");

    const amountOptions = ['\n[1] 0.01 ETH', '[2] 0.1 ETH', '[3] 1 ETH', '[4] 10 ETH', '[5] Return to the menu'];

    for (let i = 0; i < amountOptions.length; i++) {
        console.log(amountOptions[i]);
    }

    let choice: string;
    let isValid: boolean = false; 
    let publicAmount: bigint = await hre.ethers.provider.getBalance(account)

    do {
        console.log('\nChose an option:')
        choice = await inputFromCLI(": ", rl);
        if (choice === '1' || choice === '2' || choice === '3' || choice === '4') {

            const thresholds = {
                '1': BigInt(10000000000000000), 
                '2': BigInt(100000000000000000), 
                '3': BigInt(1000000000000000000), 
                '4': BigInt(10000000000000000000) 
            };
    
            if (publicAmount >= thresholds[choice]) {
                isValid = true;
                rl.close();
            } else {
                console.log("\nInsufficient funds.");
            }
    
        }
        else if (choice === '5') {
            console.log("\n");
            isValid = true;
            rl.close();
            return;
        }
        else {
            console.log('\nInvalid input.');
        }
    } while (!isValid);

    let ethValue: EthersStr;
    let functionName: string = "append_commitment";
    let id: string;
    let amountInWei;

    switch (choice) {
        case '1':
            ethValue = "0.01";
            amountInWei = hre.ethers.parseEther(ethValue);
            id = ONBOARDING_MIXER_ADDRESS_TEST;
            break;
        case '2':
            ethValue = "0.1";
            amountInWei = hre.ethers.parseEther(ethValue);
            id = ONBOARDING_MIXER_ADDRESS_LOW;
            break;
        case '3':
            ethValue = "1";
            amountInWei = hre.ethers.parseEther(ethValue);
            id = ONBOARDING_MIXER_ADDRESS_MEDIUM;
            break;
        case '4':
            ethValue = "10";
            amountInWei = hre.ethers.parseEther(ethValue);
            id = ONBOARDING_MIXER_ADDRESS_HIGH;
            break;
        default:
            ethValue = "0"; 
            id = "";
    }

    // 2) create the note 

    const {noteString, nullifierHex, commitmentHex} = await createNote(ethValue);

    const link: LinkNote = {
        type: "notev1",
        note: noteString,
        sender: name,
        sender_address: account,
        ethers: ethValue, // 0.01, 0.1, 1 or 10 eth
        id: id // address of the onboarding mixer contract
    };

    // 3) append the commitment to the mixer contract

    const code = await hre.ethers.provider.getCode(account); // get the bytecode of the smart account
    if (code !== "0x") {
      initCode = "0x";
    }
    
    await call_userop(functionName, [id, commitmentHex, amountInWei], account , initCode, signer);

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

    // 5) insert contact in the 'Contacts' table of the sender and insert <nameOnbUser, nullifierHex, amount, redeemed> in the 'Nullifiers' table
    
    insertContact(getID(name), nameOnbUser, "0x");

    insertUserNullifier(getID(name), nameOnbUser, nullifierHex, Number(ethValue));

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

    let askForRelayer: boolean = true;

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
            askForRelayer = false;
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

        console.log("\nGenerating proof of innocence ...");

        const events: CommitmentEvents = await fetchCommitments()

        const params: GeneratePOIParams = {
            inputs: result.unspentUtxo,
            events: events,
            senderAddress: account
        }

        const args_poi = await generatePOI(params);

        const { args, extData } = result;

        if (args_poi) {

            const signers = await hre.ethers.getSigners();
            try {
                await call_userop("callTransact", [UTXOS_POOL_ADDRESS_WITH_COMPLIANCE, args, args_poi, extData], RELAYER_V3_ADDRESS , INIT_CODE_RELAYER_V3, signers[3]); 
            }
            catch (error) {
                console.error("\nSomething went wrong during the transfer transaction:", error);
                console.log("\n");
            }
 

        } else {

            console.log("\nPOI generation failed");

        }
     
    } else {
        console.log("\nTransfer preparation failed\n");
    }

    
    rl.close();

}

export async function receive(signer: any, account: string, initCode: string) {

    // we can choose wether fund the public amount (needed to onboard people) or add a new utxo to fund the private amount

    console.log("\nThrough this page you can fund the public amount or the private amount.");

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    console.log("\n[1] Fund the public amount: external wallet --> smart-wallet \n[2] Fund the private amount: smart-wallet --> private amount \n[3] Return to the menu");

    let choice: string;
    let isValid: boolean = false; 

    do {
        console.log("\nChose an option:");
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

    if (choice === '1') { 
        let choiceAmountParsed = hre.ethers.parseEther(choiceAmount);
        const fundTx = await signer.sendTransaction({
            to: account,
            value: choiceAmountParsed
        });
        await fundTx.wait();
        console.log(`\nFunded public amount with ${choiceAmount} ethers: ${fundTx.hash}`)
        console.log('\n');
    } 

    else {
        // add a new utxo with that value only if the address is not in the sacitonated list

        console.log("\nChecking if the address is present in the sanctioned list");
        console.log("Or if it has been involved in transactions with sanctioned addresses");
        console.log("...")

        const { sanction, message } = await checkSanctionedAddress(account, 2); // be carefull to increse the number of hops, complexity can increase exponentially
        
        if (sanction) {
            console.log("\nYou cannot fund the private amount.");
            console.log(`\n${message}\n`);
            return;
        } else {
            console.log(`\n${message}`);
        }

        const result = await prepareDeposit(choiceAmount, account, signer);
        if (result) {
            const { args, extData } = result;
            try {
                await call_userop("callDeposit", [UTXOS_POOL_ADDRESS_WITH_COMPLIANCE, args, extData], account , initCode, signer);
                console.log(`\nFunded private amount with ${choiceAmount} ethers\n`)
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
        const amount = unredeemedNullifiers[i].amount;
        let contactAddress = "0x";

        // selecting the mixer contract address based on the amount
        switch (amount) {
            case 0.01:
                contactAddress = ONBOARDING_MIXER_ADDRESS_TEST;
                break;
            case 0.1:
                contactAddress = ONBOARDING_MIXER_ADDRESS_LOW;
                break;
            case 1:
                contactAddress = ONBOARDING_MIXER_ADDRESS_MEDIUM;
                break;
            case 10:
                contactAddress = ONBOARDING_MIXER_ADDRESS_HIGH;
                break;
            default:
                contactAddress = "0x";
        }

        // fetching Withdrawal events from the mixer contract
        const contract = await hre.ethers.getContractAt("OnboardingMixer", contactAddress);
        const filter = contract.filters.Withdrawal();
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

        console.log("\nGenerating proof of innocence ...");

        const events: CommitmentEvents = await fetchCommitments()

        const params: GeneratePOIParams = {
            inputs: result.unspentUtxo,
            events: events,
            senderAddress: account
        }

        const args_poi = await generatePOI(params);

        if (args_poi) {

            const { args, extData } = result;

            try {
                await call_userop("callTransact", [UTXOS_POOL_ADDRESS_WITH_COMPLIANCE, args, args_poi, extData], account , initCode, signer);
                console.log("\nProof of innocence verified succesfully!");
                console.log(`\nWithdrawal of ${choiceAmount} eth completed succesfully!\n`);
            }
            catch (error) {
                console.error("\nSomething went wrong during the withdrawal transaction:", error);
                console.log("\n");
            }

        }

        else {

            console.log("\nPOI generation failed");

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