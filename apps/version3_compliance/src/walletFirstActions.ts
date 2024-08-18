import dotenv from 'dotenv';
import fs from 'fs';
import hre from "hardhat";
import path from 'path';
import * as readline from 'readline';

import { inputFromCLI } from './utils/inputFromCLI';
import { LinkNote } from './types/link';
import { redeem } from './note/redeemNote';
import { setup, checkAccountBalance, inviteUsingLink, send, receive, refresh, showContacts, withdraw, exit } from './walletActions';
import { showMenu } from './menu/menu';
import { OnbUser } from "./types/onbUser";

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
        await setup(username, account, initCode, signers[index]);
        currentAction = '1';
        break;
      case '2':
        await checkAccountBalance(username, account);
        currentAction = '2';
        break;
      case '3':
        await inviteUsingLink(username, account, initCode, signers[index]);
        currentAction = '3';
        break;
      case '4':
        currentAction = '4';
        await receive(signers[index], account, initCode); 
        break;
      case '5':
        currentAction = '5'; 
        await send(username, account, initCode, signers[index]);  
        break;
      case '6':
        currentAction = '6';
        await withdraw(username, account, initCode, signers[index]);
        break;
      case '7':
        currentAction = '7';
        await showContacts(username);
        break;
      case '8':
        currentAction = '8';
        await refresh(username);
        break
      case '9':
        currentAction = '9';
        await exit(username);
        break;
      default:
        console.log("\nInvalid action");
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

  rl.close();

  console.log('\nThe username is available');

  console.log('\nCreating smart account ...');

  let index = parseInt(process.env.INDEX_ACCOUNT || '', 10);
  
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

  // write index++ to .env
  envConfig.INDEX_ACCOUNT = (index + 1).toString();
  const updatedEnv = Object.entries(envConfig).map(([key, value]) => `${key}=${value}`).join('\n');
  fs.writeFileSync('.env', updatedEnv);

  console.log('\nSome sepolia eth will be sent to your account soon ...');
  
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

export async function alreadyRegistered() {
  console.log('\nThis is the wanna be page for already registered users')
  console.log('\nNot in our scope for now');
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
        await setup(username, account, initCode, signers[index]);
        currentAction = '1';
        break;
      case '2':
        await checkAccountBalance(username, account);
        currentAction = '2';
        break;
      case '3':
        await inviteUsingLink(username, account, initCode, signers[index]);
        currentAction = '3';
        break;
      case '4':
        currentAction = '4';
        await receive(signers[index], account, initCode); 
        break;
      case '5':
        currentAction = '5'; 
        await send(username, account, initCode, signers[index]);  
        break;
      case '6':
        currentAction = '6';
        await withdraw(username, account, initCode, signers[index]);
        break;
      case '7':
        currentAction = '7';
        await showContacts(username);
        break;
      case '8':
        currentAction = '8';
        await refresh(username);
        break
      case '9':
        currentAction = '9';
        await exit(username);
        break;
      default:
        console.log("\nInvalid action");
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
  
  let index = parseInt(process.env.INDEX_ACCOUNT || '', 10);

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