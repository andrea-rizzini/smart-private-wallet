import hre from "hardhat";
require("dotenv").config();

const ACCOUNT_ALICE: string = process.env.TEST_ACCOUNT_ADDRESS || '';
let INIT_CODE_ALICE: string = process.env.INIT_CODE_TEST_ACCOUNT || '';
const EP_ADDRESS: string = process.env.ENTRY_POINT_ADDRESS || '';
const PAYMASTER_ADDRESS: string = process.env.PAYMASTER_ADDRESS || '';

async function main() {

  const ep = await hre.ethers.getContractAt("EntryPoint", EP_ADDRESS);
  const [signer0] = await hre.ethers.getSigners(); 

  const codeAlice = await hre.ethers.provider.getCode(ACCOUNT_ALICE); // get the bytecode of the smart account
  if (codeAlice !== "0x") {
    INIT_CODE_ALICE = "0x"; // this is needed to avoid AA10 sender already constructed
  }

  // create a user op to test the smart account
  const Account = await hre.ethers.getContractFactory("Account"); 
  const userOp = {
      sender: ACCOUNT_ALICE, // smart account address
      nonce: "0x" + (await ep.getNonce(ACCOUNT_ALICE, 0)).toString(16), // converted into an exadecimal string
      initCode: INIT_CODE_ALICE,
      callData: Account.interface.encodeFunctionData("test", []),
      paymasterAndData: PAYMASTER_ADDRESS,
      signature: "0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c", // dummy signature needed to hash userOp
      preVerificationGas: "0x0",
      verificationGasLimit: "0x0",
      callGasLimit: "0x0",
      maxFeePerGas: "0x0",
      maxPriorityFeePerGas: "0x0",
  };
  const { preVerificationGas, verificationGasLimit, callGasLimit } =
      await hre.ethers.provider.send("eth_estimateUserOperationGas", [
      userOp,
      EP_ADDRESS,
      ]);
  userOp.preVerificationGas = preVerificationGas;
  userOp.verificationGasLimit = verificationGasLimit;
  userOp.callGasLimit = callGasLimit;
  const { maxFeePerGas } = await hre.ethers.provider.getFeeData();
  userOp.maxFeePerGas = maxFeePerGas ? "0x" + maxFeePerGas.toString(16) : "0x0";
  const maxPriorityFeePerGas = await hre.ethers.provider.send(
      "rundler_maxPriorityFeePerGas"
  );
  userOp.maxPriorityFeePerGas = maxPriorityFeePerGas;
  const userOpHash = await ep.getUserOpHash(userOp);
  userOp.signature = await signer0.signMessage(hre.ethers.getBytes(userOpHash)); 
  const opHash = await hre.ethers.provider.send("eth_sendUserOperation", [
      userOp,  
      EP_ADDRESS,
  ]);
  setTimeout(async () => {
    const { transactionHash } = await hre.ethers.provider.send(
      "eth_getUserOperationByHash",
      [opHash]
    );
    console.log("transaction hash: ",transactionHash);
  }, 5000);
  console.log("\n");

  // check the number of interactions with the contract Account
  const account = await hre.ethers.getContractAt("Account", ACCOUNT_ALICE);
  const count =  await account.counter(); 
  console.log("Number of interactions with contract Account: ", count.toString(), "times");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })