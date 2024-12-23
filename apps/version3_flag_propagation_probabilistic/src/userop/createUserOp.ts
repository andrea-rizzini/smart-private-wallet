import hre from 'hardhat';

const EP_ADDRESS: string = process.env.ENTRY_POINT_ADDRESS || '';
const PAYMASTER_ADDRESS: string = process.env.PAYMASTER_ADDRESS || '';

export async function call_userop(contract:string, function_name: string, args: any[], sender: string, initCode: string, signer: any) {

  const code = await hre.ethers.provider.getCode(sender); // get the bytecode of the smart account
  if (code !== "0x") {
    initCode = "0x";
  }

  const ep = await hre.ethers.getContractAt("EntryPoint", EP_ADDRESS);
  const Account = await hre.ethers.getContractFactory(contract); 
  const userOp = {
    sender: sender, // smart account address
    nonce: "0x" + (await ep.getNonce(sender, 0)).toString(16), // converted into an exadecimal string
    initCode: initCode,
    callData: Account.interface.encodeFunctionData(function_name, args),
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

  // fee estimation
  const block = await hre.ethers.provider.getBlock("latest");

  const gasFee = Math.min(Number(maxFeePerGas), maxPriorityFeePerGas + block?.baseFeePerGas)

  const fee = gasFee * (Number(preVerificationGas))

  console.log("preVerificationGas: ", preVerificationGas);
  console.log("verificationGasLimit: ", verificationGasLimit);
  console.log("callGasLimit: ", callGasLimit);

  console.log("Gas fee: ", gasFee);
  console.log("Gas: ", preVerificationGas);
  console.log("Fee: ", fee);

  const userOpHash = await ep.getUserOpHash(userOp); // except the signature
  userOp.signature = await signer.signMessage(hre.ethers.getBytes(userOpHash)); // we sign the hash of the userOp itself, that is unqiue; in this way we avoid replay attacks
  const opHash = await hre.ethers.provider.send("eth_sendUserOperation", [
    userOp, // userOp object   
    EP_ADDRESS, // The entrypoint address the request should be sent through. 
  ]);

  await new Promise(resolve => setTimeout(resolve, 3000));

  let receipt = await hre.ethers.provider.send("eth_getUserOperationReceipt", [opHash]);
  console.log(receipt)

  await new Promise(resolve => setTimeout(resolve, 3000));

  receipt = await hre.ethers.provider.send("eth_getUserOperationReceipt", [opHash]);
  console.log(receipt);

  await new Promise(resolve => setTimeout(resolve, 3000));

  receipt = await hre.ethers.provider.send("eth_getUserOperationReceipt", [opHash]);
  console.log(receipt);

  await new Promise(resolve => setTimeout(resolve, 3000));

  receipt = await hre.ethers.provider.send("eth_getUserOperationReceipt", [opHash]);
  console.log(receipt);
  
}