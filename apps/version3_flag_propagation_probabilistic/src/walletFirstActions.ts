import bcrypt from 'bcrypt';
import fs from 'fs';
import hre from "hardhat";
import path from 'path';
import * as readline from 'readline';
import * as readlineSync from 'readline-sync';

import { call_userop } from './userop/createUserOp';
import { delay } from './utils/delay';
import { deleteUser, getID, getUserByUsername, insertContact, insertKeypairOnboarding, insertUser, usernameExists } from '../database/database';
import { getAccountAddress, getUtxoFromKeypair } from './pool/poolFunctions';
import { inputFromCLI } from './utils/inputFromCLI';
import { Keypair } from './pool/keypair';
import { LinkNote } from './types/link';
import { prepareDeposit } from './pool/poolPrepareActions';
import { setup, checkAccountBalance, inviteUsingLink, send, receive, refresh, showContacts, withdraw, exit } from './walletActions';
import { showMenu } from './menu/menu';
import { toBuffer } from './pool/utxo';

const ENCRYPTED_DATA_ADDRESS: string = process.env.ENCRYPTED_DATA_ADDRESS || '';
const EP_ADDRESS: string = process.env.ENTRY_POINT_ADDRESS || '';
const ACCOUNT_FACTORY_V3_PROBABILISTIC_ADDRESS: string = process.env.ACCOUNT_FACTORY_V3_PROBABILISTIC_ADDRESS || '';
const MIXER_ONBOARDING_AND_TRANSFERS_V3_PROBABILISTIC = process.env.MIXER_ONBOARDING_AND_TRANSFERS_V3_PROBABILISTIC || '';
const USDC_ADDRESS: string = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'

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
        await checkAccountBalance(username, account);
        currentAction = '2';
        break;
      case '2':
        await inviteUsingLink(username, account, initCode, signers[index]);
        currentAction = '3';
        break;
      case '3':
        currentAction = '4';
        await receive(signers[index], account, initCode); 
        break;
      case '4':
        currentAction = '5'; 
        await send(username, account, initCode, signers[index]);  
        break;
      case '5':
        currentAction = '6';
        await withdraw(username, account, initCode, signers[index]);
        break;
      case '6':
        currentAction = '7';
        await showContacts(username);
        break;
      case '7':
        currentAction = '8';
        await refresh(username, account);
        break
      case '8':
        currentAction = '9';
        await exit(username);
        break;
      default:
        console.log("\nInvalid action");
        break;
    }
    await getChoice();
  }

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
  
  let username: string;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  while (true) {
    username = await inputFromCLI('\nChoose a username: ', rl);
    if (usernameExists(username)) {
        console.log('\nUsername already exists. Please choose another one.');
    } else {
        break; 
    }
  }

  rl.close();

  let password: string;
  let password_two: string;

  do {
    password = readlineSync.question('\nChose a password: ', {
      hideEchoBack: true 
    });
  
    password_two = readlineSync.question('\nRepeat the password: ', {
      hideEchoBack: true 
    });

    if (password !== password_two) {
      console.log('\nPasswords do not match. Please try again.');
    }

  } while (password !== password_two);

  let passwordHash = bcrypt.hashSync(password, 10);

  let index: number = insertUser(username, passwordHash) - 1;

  console.log('\nCreating smart account ...');

  // deploy new account
  const AccountFactory = await hre.ethers.getContractFactory("contracts/src/FlagPropagationProbabilistic/AccountForV3Probabilistic.sol:AccountFactory"); 
  const signers = await hre.ethers.getSigners(); // signers[i] is the whole object
  const address = await signers[index].getAddress(); 

  const ep = await hre.ethers.getContractAt("EntryPoint", EP_ADDRESS, signers[2]);

  let initCode = ACCOUNT_FACTORY_V3_PROBABILISTIC_ADDRESS + AccountFactory.interface.encodeFunctionData("createAccount", [address]).slice(2);
  let account: string = "0x";
  try {
    await ep.getSenderAddress(initCode);
  }
  catch (error: any) {
    account = "0x" + error.data.slice(-40); 
  }

  const _account = await hre.ethers.getContractAt("contracts/src/FlagPropagationProbabilistic/AccountForV3Probabilistic.sol:Account", account);

  console.log("\nRegistering account's public key in the pool ...")
  await setup(username, account, initCode, signers[index]);
  await new Promise(resolve => setTimeout(resolve, 7000));

  // first send money from external wallet to the account smart contract, then call deposit to append the UTXO
  console.log('\nSome USDC will be sent to your account soon ...');

  const usdc = await hre.ethers.getContractAt("IERC20", USDC_ADDRESS, signers[2]);
  const usdcAmount = hre.ethers.parseUnits("0.01", 6);

  await usdc.approve(account, usdcAmount);

  await delay(5000); // wait for 5 seconds to avoid nonce issues

  const transferTx = await usdc.transfer(account, usdcAmount);
  await transferTx.wait();

  // here we assume the fresh address just created is not sanctioned, hence the check is not needed and it's allowed to proceed with the deposit
  // being a fresh address there is no way to tell if it's illicit or not

  const result = await prepareDeposit("0.01", account, signers[index]);

  if (result) {
  
      const { args, extData } = result;

      try {
          await call_userop("contracts/src/FlagPropagationProbabilistic/AccountForV3Probabilistic.sol:Account", "callDeposit", [MIXER_ONBOARDING_AND_TRANSFERS_V3_PROBABILISTIC, args, extData], account , initCode, signers[index]);
          console.log(`\nFunded private amount with 0.01 USDC`)          
      }
      catch (error) {
        console.error("\nSomething went wrong during the deposit transaction:", error);
      }
      
  }
  else {
      console.log("\nDeposit preparation failed\n");
      
  }   
  console.log('\nWelcome !\n');

  // menu options
  await getChoice();
  
}

export async function login() {

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
        await checkAccountBalance(username, account);
        currentAction = '2';
        break;
      case '2':
        await inviteUsingLink(username, account, initCode, signers[index]);
        currentAction = '3';
        break;
      case '3':
        currentAction = '4';
        await receive(signers[index], account, initCode); 
        break;
      case '4':
        currentAction = '5'; 
        await send(username, account, initCode, signers[index]);  
        break;
      case '5':
        currentAction = '6';
        await withdraw(username, account, initCode, signers[index]);
        break;
      case '6':
        currentAction = '7';
        await showContacts(username);
        break;
      case '7':
        currentAction = '8';
        await refresh(username, account);
        break
      case '8':
        currentAction = '9';
        await exit(username);
        break;
      default:
        console.log("\nInvalid action");
        break;
    }
    await getChoice();
  }

  console.log ("\nLogin page");

  let areCorrectCredentials = false;

  let username: string;
  let password: string;

  let index: number = -1;

  while (!areCorrectCredentials) {
    
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    username = await inputFromCLI('\nUsername: ', rl);

    rl.close();

    password = readlineSync.question('\nInsert the password: ', {
      hideEchoBack: true 
    });
    
    const user: any = getUserByUsername(username);

    if (!user) {
      console.log('\nUser does not exist. Please try again.');
      continue;
    }

    const queriedUsername: string = user.username;
    const queriedPassword: string = user.passwordHash;

    const isMatch = bcrypt.compareSync(password, queriedPassword);

    if (isMatch && username === queriedUsername) {
      console.log('\nCorrect credentials');
      index = getID(username) - 1;
      areCorrectCredentials = true;
    } else {
      console.log('\nIncorrect credentials. Please try again.');
    }

  }

  console.log('\nLogged in successfully !\n');

  const signers = await hre.ethers.getSigners(); 
  const address = await signers[index].getAddress(); 

  const ep = await hre.ethers.getContractAt("EntryPoint", EP_ADDRESS, signers[2]);
  const AccountFactory = await hre.ethers.getContractFactory("contracts/src/FlagPropagationProbabilistic/AccountForV3Probabilistic.sol:AccountFactory"); 

  let initCode = ACCOUNT_FACTORY_V3_PROBABILISTIC_ADDRESS + AccountFactory.interface.encodeFunctionData("createAccount", [address]).slice(2); // first 20 byte are the factory address, the rest is calldata
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
        await checkAccountBalance(username, account);
        currentAction = '2';
        break;
      case '2':
        await inviteUsingLink(username, account, initCode, signers[index]);
        currentAction = '3';
        break;
      case '3':
        currentAction = '4';
        await receive(signers[index], account, initCode); 
        break;
      case '4':
        currentAction = '5'; 
        await send(username, account, initCode, signers[index]);  
        break;
      case '5':
        currentAction = '6';
        await withdraw(username, account, initCode, signers[index]);
        break;
      case '6':
        currentAction = '7';
        await showContacts(username);
        break;
      case '7':
        currentAction = '8';
        await refresh(username, account);
        break
      case '8':
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

  function bigIntReviver(key: string, value: any) {
    // Controlla se il valore è una stringa e contiene solo numeri
    return typeof value === 'string' && /^\d+$/.test(value) ? BigInt(value) : value;
  }

  const jsonData = fs.readFileSync(filePath, 'utf-8');
  const link: LinkNote = JSON.parse(jsonData, bigIntReviver); 

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  let username: string;

  while (true) {
    username = await inputFromCLI('\nChoose a username: ', rl);
    if (usernameExists(username)) {
        console.log('\nUsername already exists. Please choose another one.');
    } else {
        break; 
    }
  }

  rl.close();

  let password: string;
  let password_two: string;

  do {
    password = readlineSync.question('\nChose a password: ', {
      hideEchoBack: true 
    });
  
    password_two = readlineSync.question('\nRepeat the password: ', {
      hideEchoBack: true 
    });

    if (password !== password_two) {
      console.log('\nPasswords do not match. Please try again.');
    }

  } while (password !== password_two);

  let passwordHash = bcrypt.hashSync(password, 10);

  let index: number = insertUser(username, passwordHash) - 1;

  const AccountFactory = await hre.ethers.getContractFactory("contracts/src/FlagPropagationProbabilistic/AccountForV3Probabilistic.sol:AccountFactory"); 
  const signers = await hre.ethers.getSigners(); // signers[i] is the whole object
  const address = await signers[index].getAddress(); 

  const ep = await hre.ethers.getContractAt("EntryPoint", EP_ADDRESS, signers[2]);

  let initCode = ACCOUNT_FACTORY_V3_PROBABILISTIC_ADDRESS + AccountFactory.interface.encodeFunctionData("createAccount", [address]).slice(2);
  let account: string = "0x";
  try {
    await ep.getSenderAddress(initCode);
  }
  catch (error: any) {
    account = "0x" + error.data.slice(-40); 
  }

  const _account = await hre.ethers.getContractAt("contracts/src/FlagPropagationProbabilistic/AccountForV3Probabilistic.sol:Account", account);

  // generate pubKey and register it in the pool
  await setup(username, account, initCode, signers[index]);

  await new Promise(resolve => setTimeout(resolve, 7000));

  const keypair_link: Keypair = new Keypair(link.key);

  try {
    const { unspentUtxo } = await getUtxoFromKeypair(keypair_link, account);
    let totalAmount = BigInt(0);
    unspentUtxo.forEach(utxo => {
      totalAmount = totalAmount + (utxo.amount)
    })

    // Update contacts with the sender of the note, once redeemed
    insertContact(getID(username), link.sender, link.sender_address);

    console.log(`\nYou have been onboarded with ${Number(totalAmount) / (10 ** 6)} USDC`);

    // insert the new keypair which allows to read the utxo related with onboarding
    insertKeypairOnboarding(getID(username), keypair_link.privkey, keypair_link.pubkey.toString(), keypair_link.encryptionKey);

    // Send encrypted data to the EncryptedAddresses contract, needed once the sender of the note refreshes 

    //fetch sender public key
    const recipientAddress = await getAccountAddress(link.sender_address)

    if (recipientAddress) {
  
      const keypair: Keypair = Keypair.fromString(recipientAddress);
  
      const bytes = Buffer.concat([toBuffer(link.challenge, 31), toBuffer(BigInt(account), 19), toBuffer(link.receiver, link.receiver.length)]);
  
      call_userop("contracts/src/FlagPropagationProbabilistic/AccountForV3Probabilistic.sol:Account", "insertIntoEncryptedData", [ENCRYPTED_DATA_ADDRESS, keypair.encrypt(bytes)], account, initCode, signers[index]);
    }
    
    // start the wallet
  
    console.log('\nWelcome !\n');

    await getChoice();
  } catch (error) {
    console.log('\nError with the link: ', error);
    deleteUser(index + 1);
  }
 
}