import fs from 'fs';
import hre from "hardhat";
import path from 'path';
import * as readline from 'readline';

import { call_userop } from "./userop/createUserOp";
import { checkSanctionedAddress } from './poi/checkIfSanctioned';
import { getAccountAddress, getAccountKeyPair, getOnbUtxoFromKeypair, getTotalAmount } from "./pool/poolFunctions";
import { getAddressOfContactOfUser, getContactsByUserId, getID, getKeyPairOnboardingByUserId, insertChallenge, insertContact, 
    insertKeypair, isChallengeRedeemed, updateContact, updateChallengeRedeemed} from '../database/database';
import { inputFromCLI } from "./utils/inputFromCLI";
import { Keypair } from "./pool/keypair";
import { LinkNote, USDCStr } from "./types/link";
import { prepareDeposit, prepareTransfer, prepareTransferForOnboarding, prepareWithdrawal } from "./pool/poolPrepareActions";
import { randomBN } from './pool/utxo';
import { Utxo } from "./pool/utxo";

const ENCRYPTED_DATA_ADDRESS = process.env.ENCRYPTED_DATA_ADDRESS || '';
const INIT_CODE_RELAYER_V3_PROBABILISTIC = process.env.INIT_CODE_RELAYER_V3_PROBABILISTIC || '';
const MIXER_ONBOARDING_AND_TRANSFERS_V3_PROBABILISTIC = process.env.MIXER_ONBOARDING_AND_TRANSFERS_V3_PROBABILISTIC || '';
const POOL_USERS_ADDRESS = process.env.POOL_USERS_ADDRESS || '';
const RELAYER_V3_PROBABILISTIC_ADDRESS = process.env.RELAYER_V3_PROBABILISTIC_ADDRESS || '';
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
        await call_userop("contracts/src/FlagPropagationProbabilistic/AccountForV3Probabilistic.sol:Account", "insertIntoPoolUsers", [POOL_USERS_ADDRESS, output.keypair.address()], account , initCode, signer);

        const index = getID(username);

        insertKeypair(index, keypair.privkey, keypair.pubkey.toString(), keypair.encryptionKey);

        // console.log("\nRegistered successfully!\n")
    }
}

export async function checkAccountBalance(username: string, account: string) {
    console.log("\nChecking account balance ...");
    
    console.log("\nAddress:", account);

    let poolAmount = BigInt(await getTotalAmount(username, account) as bigint);

    try {
        let keyPair: Keypair = getKeyPairOnboardingByUserId(getID(username)) as Keypair;
        const keypair_link: Keypair = new Keypair(keyPair.privkey);
        if (keypair_link) {
            const { unspentUtxoOnb } = await getOnbUtxoFromKeypair(keypair_link, account);
            let totalAmountLink = BigInt(0);
            unspentUtxoOnb.forEach(utxo => {
                totalAmountLink = totalAmountLink + (utxo.amount);
            })
            poolAmount = poolAmount + totalAmountLink;
        }
    } catch (error) {
        // console.error("");
    }

    const poolAmountFormatted = Number(poolAmount) / (10 ** 6);
    console.log(`\nPrivate account balance: ${poolAmountFormatted.toString()} USDC\n`, );
    
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
            return;
        }
        else {
            console.log("\nInvalid amount. Please enter a valid number.");
        }
    } while (!isValid);

    rl.close();

    let usdcValue: USDCStr = `${parseFloat(choiceAmount)}` as USDCStr;
    let id: string = MIXER_ONBOARDING_AND_TRANSFERS_V3_PROBABILISTIC;

    // 2) create the utxo 
    const recipientUtxoOnboarding = new Utxo({
        amount: hre.ethers.parseUnits(usdcValue, 6),
    })

    const link: LinkNote = {
        type: "notev1",
        key: recipientUtxoOnboarding.keypair.privkey,
        sender: name,
        sender_address: account,
        receiver: nameOnbUser,
        usdc: usdcValue, // arbitrary denomination
        id: id, // address of the onboarding mixer contract
        challenge: randomBN()
    };

    // 3) append the utxo to the mixer contract 

    const result = await prepareTransferForOnboarding(choiceAmount, recipientUtxoOnboarding, name, account, signer);

    if (result) {
        const signers = await hre.ethers.getSigners();
        const { args, argsBloom, extData } = result;
        try {
            await call_userop("contracts/src/FlagPropagationProbabilistic/RelayerForV3Probabilistic.sol:Relayer", "callTransact", [MIXER_ONBOARDING_AND_TRANSFERS_V3_PROBABILISTIC, args, argsBloom, extData], RELAYER_V3_PROBABILISTIC_ADDRESS , INIT_CODE_RELAYER_V3_PROBABILISTIC, signers[3]); 
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

    // 4) send the link to the invited user

    console.log(`\nSending link via whatsapp to ${nameOnbUser} ... [simulated]`);
    console.log("\nSending: \n")
    console.log(link);
    console.log("\n");

    function bigIntReplacer(key: string, value: any) {
        return typeof value === 'bigint' ? value.toString() : value;
    }

    let jsonString = JSON.stringify(link, bigIntReplacer, 2);
    let dirPath = path.join(__dirname, '../links/');
    let filePath = path.join(dirPath, 'linkNote.json');

    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }

    fs.writeFileSync(filePath, jsonString);

    // 5) append the OnbUser to the contacts table of the sender and append <nameOnbUser, nullifierHex, amount, redeemed> to the nullifiers table
    
    insertContact(getID(name), nameOnbUser, "0x");

    insertChallenge(getID(name), nameOnbUser, link.challenge.toString());
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

    try {
        const result = await prepareTransfer(choiceAmount, username, account, addressReceiver, signer);
        
        if (result) {
          const signers = await hre.ethers.getSigners();
          const { args, argsBloom, extData } = result;
          try {
            await call_userop("contracts/src/FlagPropagationProbabilistic/RelayerForV3Probabilistic.sol:Relayer", "callTransact", 
                              [MIXER_ONBOARDING_AND_TRANSFERS_V3_PROBABILISTIC, args, argsBloom, extData], 
                              RELAYER_V3_PROBABILISTIC_ADDRESS, INIT_CODE_RELAYER_V3_PROBABILISTIC, signers[3]); 
            console.log(`\nTransfer of ${choiceAmount} USDC completed successfully!\n`);
          } catch (error) {
            console.error("\nSomething went wrong during the transfer transaction:", error);
            console.log("\n");
          }
        } else {
          console.log("\nTransfer preparation failed\n");
        }
      } catch (error) {
        console.log(error);
      }
    
    rl.close();

}

export async function receive(signer: any, account: string, initCode: string) {

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
            await call_userop("contracts/src/FlagPropagationProbabilistic/AccountForV3Probabilistic.sol:Account", "callDeposit", [MIXER_ONBOARDING_AND_TRANSFERS_V3_PROBABILISTIC, args, extData], account , initCode, signer);
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

export async function refresh(username: string, account: string) {
    console.log('\nRefreshing ...');
    console.log('\n');

    const address = await getAccountAddress(account) 

    if (address) {
        const keyPair = await getAccountKeyPair(username, address)
        const keypair_ = new Keypair(keyPair?.privkey)

        // 1) fetch all the events of EncryptedData
        const contract = await hre.ethers.getContractAt("EncryptedDataOnboardedUsers", ENCRYPTED_DATA_ADDRESS);
        let filter = contract.filters.EncryptedData();
        const events= await contract.queryFilter(filter);

        // 2) filter the events of the user

        events.forEach((event) => {
            const encryptedData = event.args[0];
            try {
                const decryptedData = keypair_.decrypt(encryptedData);
                let challenge = BigInt('0x' + decryptedData.slice(0,31).toString('hex'))
                let address = ('0x' + decryptedData.slice(31, 51).toString('hex'));
                let name = decryptedData.slice(51).toString('utf-8');
                if (!isChallengeRedeemed(getID(username), challenge.toString())) {
                    updateChallengeRedeemed(getID(username), challenge.toString());
                    updateContact(getID(username), name, address);
                }

            }
            catch (error) {
            }
        })

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

    let addressWithdrawal: string = await inputFromCLI("\nEnter the address to which you want to withdraw (or type exit to return to the menu): ", rl);

    rl.close();
    const result = await prepareWithdrawal(choiceAmount, username, account, addressWithdrawal, signer);

    if (result) {
        const { args, argsBloom, extData } = result;
        try {

            console.log ('\nChecking Proof of Innocence ...');
            
            await call_userop("contracts/src/FlagPropagationProbabilistic/AccountForV3Probabilistic.sol:Account", "callWithdraw", [MIXER_ONBOARDING_AND_TRANSFERS_V3_PROBABILISTIC, args, argsBloom, extData], account, initCode, signer);

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