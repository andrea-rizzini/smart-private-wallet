import hre from "hardhat";
import { run } from "hardhat";
import dotenv from 'dotenv';
import fs from 'fs';

const EP_ADDRESS: string = process.env.ENTRY_POINT_ADDRESS || '';
const FACTORY_ADDRESS: string = process.env.ACCOUNT_FACTORY_ADDRESS || '';
const PAYMASTER_ADDRESS: string = process.env.PAYMASTER_ADDRESS || '';

async function main() {

  const envConfig = dotenv.parse(fs.readFileSync('.env'));

  // remember to redeploy Factroy first

  if (!EP_ADDRESS || !FACTORY_ADDRESS || !PAYMASTER_ADDRESS) {
      throw new Error("Environment variables ENTRY_POINT_ADDRESS and PAYMASTER_ADDRESS must be defined");
  }

  // deploy test account
  const AccountFactory = await hre.ethers.getContractFactory("AccountFactory"); 
  const [signer0] = await hre.ethers.getSigners(); // signer0 is the whole object

  const address0 = await signer0.getAddress(); // address0 is the address of the signer0, the wallet address

  const ep = await hre.ethers.getContractAt("EntryPoint", EP_ADDRESS);
  
  // create the sender 
  let initCodeAlice = FACTORY_ADDRESS + AccountFactory.interface.encodeFunctionData("createAccount", [address0]).slice(2);
  let alice: string = "0x";
  try {
    await ep.getSenderAddress(initCodeAlice);
  }
  catch (error: any) {
    alice = "0x" + error.data.slice(-40); 
  }

  const codeAlice = await hre.ethers.provider.getCode(alice); // get the bytecode of the smart account
  if (codeAlice !== "0x") {
    initCodeAlice = "0x";
  }

  const account = await hre.ethers.getContractAt("Account", alice);
  console.log("Address:", alice);

  envConfig.TEST_ACCOUNT_ADDRESS = alice;
  envConfig.INIT_CODE_TEST_ACCOUNT = initCodeAlice;

  // write new addresses to .env file
  const updatedEnv = Object.entries(envConfig).map(([key, value]) => `${key}=${value}`).join('\n');
  fs.writeFileSync('.env', updatedEnv);

  // create a user op to test the smart account
  // const Account = await hre.ethers.getContractFactory("Account"); 
  //   const userOp = {
  //       sender: alice, // smart account address
  //       nonce: "0x" + (await ep.getNonce(alice, 0)).toString(16), // converted into an exadecimal string
  //       initCode: initCodeAlice,
  //       callData: Account.interface.encodeFunctionData("test", []),
  //       paymasterAndData: PAYMASTER_ADDRESS,
  //       signature: "0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c", // dummy signature needed to hash userOp
  //       preVerificationGas: "0x0",
  //       verificationGasLimit: "0x0",
  //       callGasLimit: "0x0",
  //       maxFeePerGas: "0x0",
  //       maxPriorityFeePerGas: "0x0",
    // };
    // const { preVerificationGas, verificationGasLimit, callGasLimit } =
    //     await hre.ethers.provider.send("eth_estimateUserOperationGas", [
    //     userOp,
    //     EP_ADDRESS,
    //     ]);
    // userOp.preVerificationGas = preVerificationGas;
    // userOp.verificationGasLimit = verificationGasLimit;
    // userOp.callGasLimit = callGasLimit;
    // const { maxFeePerGas } = await hre.ethers.provider.getFeeData();
    // userOp.maxFeePerGas = maxFeePerGas ? "0x" + maxFeePerGas.toString(16) : "0x0";
    // const maxPriorityFeePerGas = await hre.ethers.provider.send(
    //     "rundler_maxPriorityFeePerGas"
    // );
    // userOp.maxPriorityFeePerGas = maxPriorityFeePerGas;
    // const userOpHash = await ep.getUserOpHash(userOp);
    // userOp.signature = await signer0.signMessage(hre.ethers.getBytes(userOpHash)); 
    // const opHash = await hre.ethers.provider.send("eth_sendUserOperation", [
    //     userOp,  
    //     EP_ADDRESS,
    // ]);
    // setTimeout(async () => {
    //     const { transactionHash } = await hre.ethers.provider.send(
    //     "eth_getUserOperationByHash",
    //     [opHash]
    //     );
    // }, 5000);
    // console.log("\n");

}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });