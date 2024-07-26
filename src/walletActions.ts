import hre from "hardhat";
import { createNote } from "./createNote";
import { inputFromCLI } from "./utils/inputFromCLI";
import { LinkNote, EthersStr } from "./types/link";
import { OnbUser } from "./types/onbUser";
import { UserNullifier } from "./types/userNullifier";
import { call_userop } from "./userop/createUserOp";
import { getUnredeemedNullifiers } from "./utils/getUnredeemedNullifiers";
import { fetchEvents } from "./utils/fetchEvents";
import * as readline from 'readline';
import fs from 'fs';
import path from 'path';

const ONBOARDING_MIXER_ADDRESS_TEST = process.env.ONBOARDING_MIXER_ADDRESS_TEST || '';
const ONBOARDING_MIXER_ADDRESS_LOW = process.env.ONBOARDING_MIXER_ADDRESS_LOW || '';
const ONBOARDING_MIXER_ADDRESS_MEDIUM = process.env.ONBOARDING_MIXER_ADDRESS_MEDIUM || '';
const ONBOARDING_MIXER_ADDRESS_HIGH = process.env.ONBOARDING_MIXER_ADDRESS_HIGH || '';

export async function checkAccountBalance(account: string) {
    console.log("\nChecking account balance ...");
    const account_ = await hre.ethers.getContractAt("Account", account);
    console.log("Address:", account);
    console.log("Account balance in wei::",
      await hre.ethers.provider.getBalance(account)
    );
    console.log("Account balance in eth: ", Number(await hre.ethers.provider.getBalance(account)) / Number(BigInt("1000000000000000000")))

    console.log("\n");
}

export async function inviteUsingLink(name: string, account: string, initCode: string, signer: any) {

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

    // 1) chose the name and the amount

    const nameOnbUser: string = await inputFromCLI("\nEnter the name of the invited user to be added on your contacts: ", rl);

    const amountOptions = ['\n[1] 0.01 ETH', '[2] 0.1 ETH', '[3] 1 ETH', '[4] 10 ETH'];

    for (let i = 0; i < amountOptions.length; i++) {
        console.log(amountOptions[i]);
    }

    let amount: string;
    let isValid: boolean = false;   

    console.log('\nChose an option:')

    do {
        amount = await inputFromCLI(": ", rl);
        rl.close();
        if (amount === '1' || amount === '2' || amount === '3' || amount === '4') {
            isValid = true;
            rl.close();
            console.log("\n")
        } else {
            console.log('\nInvalid input.\n');
        }
    } while (!isValid);

    let ethValue: EthersStr;
    let functionName: string = "append_commitment";
    let id: string;
    let flag: number;

    switch (amount) {
        case '1':
            ethValue = "0.01";
            id = ONBOARDING_MIXER_ADDRESS_TEST;
            flag = 1;
            break;
        case '2':
            ethValue = "0.1";
            id = ONBOARDING_MIXER_ADDRESS_LOW;
            flag = 2;
            break;
        case '3':
            ethValue = "1";
            id = ONBOARDING_MIXER_ADDRESS_MEDIUM;
            flag = 3;
            break;
        case '4':
            ethValue = "10";
            id = ONBOARDING_MIXER_ADDRESS_HIGH;
            flag = 4;
            break;
        default:
            ethValue = "0"; 
            flag = 0;
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
    
    call_userop(functionName, [id, commitmentHex, flag], account , initCode, signer);

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

    // 5) append the OnbUser to the contacts.json file of the sender and append <nameOnbUser, nullifierHex> to the nullifiers.json file

    const onbUser: OnbUser = {
        name: nameOnbUser,
        address: "0x" // it's 0x until the redeemption of the note
    };

    dirPath = path.join(__dirname, `../contacts/${name}/`);
    filePath = path.join(dirPath, 'contacts.json');

    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }

    let contactsArray: OnbUser[] = []; 
    if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        if (fileContent) {
            contactsArray = JSON.parse(fileContent);
        }
    }

    contactsArray.push(onbUser);
    jsonString = JSON.stringify(contactsArray, null, 2);
    fs.writeFileSync(filePath, jsonString);

    const userNullifier: UserNullifier = {
        name: nameOnbUser,
        nullifier: nullifierHex,
        amount: Number(ethValue),
        redeemed: false
    };

    dirPath = path.join(__dirname, `../nullifiers/${name}/`);
    filePath = path.join(dirPath, 'nullifiers.json');

    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }

    let nullifiersArray: UserNullifier[] = []; 
    if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        if (fileContent) {
            nullifiersArray = JSON.parse(fileContent);
        }
    }

    nullifiersArray.push(userNullifier);
    jsonString = JSON.stringify(nullifiersArray, null, 2);
    fs.writeFileSync(filePath, jsonString);

}


export async function send() {
    console.log("\nAvaible soon in version 2")
}

export async function receive(signer: any, account: string) {
    const depositValue = hre.ethers.parseEther("0.01");
    const fundTx = await signer.sendTransaction({
        to: account,
        value: depositValue
    });
    await fundTx.wait();
    console.log(`\nFunded account with 0.01 ether: ${fundTx.hash}`)
    console.log('\n');
}

export async function refresh(name: string) {
    console.log('\nRefreshing ...');
    console.log('\n');

    let dirPath = path.join(__dirname, `../nullifiers/${name}/`);
    let filePath = path.join(dirPath, 'nullifiers.json');

    let unredeemedNullifiers;

    try {
        unredeemedNullifiers = await getUnredeemedNullifiers(filePath);
    } catch (error) {
        unredeemedNullifiers = [];
        console.error(`Error during refresh of directory "${dirPath}":`, error);
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

                // modify unredeemedNullifiers[i].redeemed to true and update the nullifiers.json file
                unredeemedNullifiers[i].redeemed = true;
                let jsonString = JSON.stringify(unredeemedNullifiers, null, 2);
                fs.writeFileSync(filePath, jsonString);
                
                // update the contacts.json file of the sender adding the address of the related contact
                dirPath = path.join(__dirname, `../contacts/${name}/`);
                filePath = path.join(dirPath, 'contacts.json');
                let contactsArray: OnbUser[] = [];
                if (fs.existsSync(filePath)) {
                    const fileContent = fs.readFileSync(filePath, 'utf-8');
                    if (fileContent) {
                        contactsArray = JSON.parse(fileContent);
                    }
                }
                contactsArray.forEach(contact => {
                    if (contact.name === name) {
                        contact.address = event.args.to;
                    }
                });
                jsonString = JSON.stringify(contactsArray, null, 2);
                fs.writeFileSync(filePath, jsonString);              
            }
          });

    }
    
}

export async function showContacts(name: string) {
    const dirPath = path.join(__dirname, `../contacts/${name}/`);
    const filePath = path.join(dirPath, 'contacts.json');

    if (fs.existsSync(filePath)) {
        const jsonData = fs.readFileSync(filePath, 'utf-8');
        const contacts: OnbUser[] = JSON.parse(jsonData);
        console.log("\nContacts: \n");
        console.log(contacts);
    } else {
        console.log("\nNo contacts in the address book.");
    }

    console.log("\n");
 }

 export async function exit(name: string) {
    console.log('\nExiting ...');

    let dirPath = path.join(__dirname, `../contacts/${name}/`);

    if (fs.existsSync(dirPath)) {
        try {
            fs.rmSync(dirPath, { recursive: true, force: true });
            // console.log(`Directory "${dirPath}" removed succesfully.`);
        } catch (err) {
            console.error(`Error during deletion of directory "${dirPath}":`, err);
        }
    } else {
        console.log(`Directory "${dirPath}" does not exist.`);
    }

    dirPath = path.join(__dirname, `../nullifiers/${name}/`);

    if (fs.existsSync(dirPath)) {
        try {
            fs.rmSync(dirPath, { recursive: true, force: true });
            // console.log(`Directory "${dirPath}" removed succesfully.`);
        } catch (err) {
            console.error(`Error during deletion of directory "${dirPath}":`, err);
        }
    } else {
        console.log(`Directory "${dirPath}" does not exist.`);
    }

    process.exit(0);

 }
