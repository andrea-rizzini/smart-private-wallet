import dotenv from 'dotenv';
import fs from 'fs';
import hre from "hardhat";
import path from 'path';
import * as readlineSync from 'readline-sync';

import { inputFromCLI } from './utils/inputFromCLI';
import { showMenu } from './menu/menu';
import { redeem } from './note/redeemNote';
import { OnbUser } from "./types/onbUser";
import { checkAccountBalance, inviteUsingLink, send, receive, refresh, showContacts, exit } from './walletActions';
import { LinkNote } from './types/link';
import * as readline from 'readline';

const EP_ADDRESS: string = process.env.ENTRY_POINT_ADDRESS || '';
const FACTORY_ADDRESS: string = process.env.ACCOUNT_FACTORY_ADDRESS || '';

export async function acceptInvite() { 

  let currentAction = '';

  async function getChoice() {
    showMenu();
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
    currentAction = await inputFromCLI('\nInsert the action you want to execute: ', rl);
    rl.close();
    await executeAction(currentAction);
  }

  async function executeAction(action: string) {
    switch (action) {
      case '1':
        await checkAccountBalance(account);
        currentAction = '1';
        break;
      case '2':
        await inviteUsingLink(username, account, initCode, signers[index]);
        currentAction = '2';
        break;
      case '3':
        currentAction = '3';
        await send();
        break;
      case '4':
        currentAction = '4'; 
        await receive(signers[index], account);      
        break;
      case '5':
        currentAction = '5';
        await showContacts(username);
        break;
      case '6':
        currentAction = '6';
        await refresh(username);
        break;
      case '7':
        await exit(username);
      default:
        console.log("Invalid action");
        break;
    }
    await getChoice();
  }

  const envConfig = dotenv.parse(fs.readFileSync('.env'));

  console.log("\nRegistration page");

  let isCorrectCode = false;
  
  while (!isCorrectCode) {

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const invitationCode = await inputFromCLI('\nEnter invite code: ', rl);

    rl.close();
    
    if (invitationCode === 'testnet') {
      console.log('\nInvitation code accepted');
      isCorrectCode = true;
    } else {
      console.log('Invalid code. Please try again.');
    }

  }
  
  const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
  });

  let username = await inputFromCLI('\nChose a username: ', rl); 

  let password: string = readlineSync.question('Chose a password: ', {
    hideEchoBack: true 
  });

  rl.close();

  console.log('\nThe username is available');

  console.log('\nCreating smart account ...');

  let index = process.env.INDEX_ACCOUNT ? parseInt(process.env.INDEX_ACCOUNT, 10) : 0;
  
  // deploy new account
  const AccountFactory = await hre.ethers.getContractFactory("contracts/src/Account.sol:AccountFactory"); 
  const signers = await hre.ethers.getSigners(); // signers[i] is the whole object
  const address = await signers[index].getAddress(); 

  const ep = await hre.ethers.getContractAt("EntryPoint", EP_ADDRESS, signers[2]);

  let initCode = FACTORY_ADDRESS + AccountFactory.interface.encodeFunctionData("createAccount", [address]).slice(2);
  let account: string = "0x";
  try {
    await ep.getSenderAddress(initCode);
  }
  catch (error: any) {
    account = "0x" + error.data.slice(-40); 
  }
  
  const code = await hre.ethers.provider.getCode(account); // get the bytecode of the smart account
  if (code !== "0x") {
    initCode = "0x";
  }

  const _account = await hre.ethers.getContractAt("Account", account);
  console.log("Address:", account);

  // write index++ to .env
  envConfig.INDEX_ACCOUNT = (index + 1).toString();
  const updatedEnv = Object.entries(envConfig).map(([key, value]) => `${key}=${value}`).join('\n');
  fs.writeFileSync('.env', updatedEnv);

  console.log('\nSome sepolia eth will be sent to your account soon ...')
  
  const depositValue = hre.ethers.parseEther("0.01");
  const signer = await hre.ethers.getSigners();
  const fundTx = await signer[2].sendTransaction({
    to: account,
    value: depositValue
  });
  await fundTx.wait();
  console.log(`\nFunded account with 0.01 ethers: ${fundTx.hash}`)
  console.log('\nWelcome !\n');

  // menu options
  await getChoice();
  
}

export async function onboardViaLink() {

  let currentAction = '';

  async function getChoice() {
    showMenu();
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    currentAction = await inputFromCLI('\nInsert the action you want to execute: ', rl);
    rl.close();
    await executeAction(currentAction);
  }

  async function executeAction(action: string) {
    switch (action) {
      case '1':
        await checkAccountBalance(account);
        currentAction = '1';
        break;
      case '2':
        await inviteUsingLink(username, account, initCode, signers[index]);
        currentAction = '2';
        break;
      case '3':
        currentAction = '3';
        await send();
        break;
      case '4':
        currentAction = '4'; 
        await receive(signers[index], account);      
        break;
      case '5':
        currentAction = '5';
        await showContacts(username);
        break;
      case '6':
        currentAction = '6';
        await refresh(username);
        break;
      case '7':
        await exit(username);
      default:
        console.log("Invalid action");
        break;
    }
    await getChoice();
  }
  
  console.log('\nOnboarding page')
  console.log('\nReading link ...');

  let dirPath = path.join(__dirname, '../links/');
  let filePath = path.join(dirPath, 'linkNote.json');

  const jsonData = fs.readFileSync(filePath, 'utf-8');
  const link: LinkNote = JSON.parse(jsonData); 
  
  let index = process.env.INDEX_ACCOUNT ? parseInt(process.env.INDEX_ACCOUNT, 10) : 0;

  const AccountFactory = await hre.ethers.getContractFactory("contracts/src/Account.sol:AccountFactory"); 
  const signers = await hre.ethers.getSigners(); // signers[i] is the whole object
  const address = await signers[index].getAddress(); 

  const ep = await hre.ethers.getContractAt("EntryPoint", EP_ADDRESS, signers[2]);

  let initCode = FACTORY_ADDRESS + AccountFactory.interface.encodeFunctionData("createAccount", [address]).slice(2);
  let account: string = "0x";
  try {
    await ep.getSenderAddress(initCode);
  }
  catch (error: any) {
    account = "0x" + error.data.slice(-40); 
  }
  
  const code = await hre.ethers.provider.getCode(account); // get the bytecode of the smart account
  if (code !== "0x") {
    initCode = "0x";
  }

  const _account = await hre.ethers.getContractAt("Account", account);
  console.log("\nAddress:", account);

  const envConfig = dotenv.parse(fs.readFileSync('.env'));

  // write index++ to .env
  envConfig.INDEX_ACCOUNT = (index + 1).toString();
  const updatedEnv = Object.entries(envConfig).map(([key, value]) => `${key}=${value}`).join('\n');
  fs.writeFileSync('.env', updatedEnv);

  await redeem(link, account, initCode, signers[index]);

  // select a username
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  let username = await inputFromCLI('\nChose a username: ', rl); // to check in a database if the username is already taken

  rl.close();

  // Update contacts with the sender of the note, once redeemed
  const onbUser: OnbUser = {
    name: link.sender,
    address: link.sender_address 
  };

  dirPath = path.join(__dirname, `../contacts/${username}/`);
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

  let jsonString = JSON.stringify(contactsArray, null, 2);

  fs.writeFileSync(filePath, jsonString);

  // start the wallet
  
  console.log('\nWelcome !\n');

  await getChoice();
}