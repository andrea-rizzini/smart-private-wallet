import { getAccountAddress, createTransactionData, getUserAccountInfo } from "./poolFunctions";
import { Keypair } from "./keypair";
import { Utxo } from "./utxo";

export async function prepareDeposit(amount: string, address: string, signer: any){
  const recipientAddress = await getAccountAddress(address)
  if (recipientAddress) {
    const keypair = Keypair.fromString(recipientAddress);
    const output = new Utxo({ amount: hre.ethers.parseEther(amount), keypair })
    const { extData, args } = await createTransactionData({ outputs: [output] }, keypair, signer)
    return { args, extData }
  } else {
    console.log('Recipient not found');
  }  
}

export async function prepareTransfer(amount: string, username: string, addressSender: string, addressReceiver: string, signer: any) {
  const recipientAddress = await getAccountAddress(addressReceiver)
  if (recipientAddress) {

    const recipientUtxo = new Utxo({
      amount: hre.ethers.parseEther(amount),
      keypair: Keypair.fromString(recipientAddress),
    })
    
    const { unspentUtxo, totalAmount, senderKeyPair } = await getUserAccountInfo(username, addressSender, {amount: hre.ethers.parseEther(amount)})
    
    if (totalAmount < (hre.ethers.parseEther(amount))) {
      throw new Error(`Insufficient funds!`)
    }

    const senderChangeUtxo = new Utxo({
      keypair: senderKeyPair,
      amount: totalAmount - (hre.ethers.parseEther(amount)),
    })

    const outputs = (totalAmount - (hre.ethers.parseEther(amount))) == BigInt(0) ? [recipientUtxo] : [recipientUtxo, senderChangeUtxo]

    const { extData, args } = await createTransactionData({ outputs, inputs: unspentUtxo }, senderKeyPair, signer)
    return { args, extData }


  } else {
    console.log('\nRecipient not registered in the pool');
  }  
} 

export async function prepareWithdrawal(amount: string, username: string, addressSender: string, signer: any) {

  const { unspentUtxo, totalAmount, senderKeyPair } = await getUserAccountInfo(username, addressSender, {amount: hre.ethers.parseEther(amount)})

  const outputs = [new Utxo({ amount: totalAmount - (hre.ethers.parseEther(amount)), keypair: senderKeyPair })]

  const { extData, args } = await createTransactionData(
    {
      outputs,
      inputs: unspentUtxo,
      recipient: addressSender,
    },
    senderKeyPair,
    signer
  )
  return { extData, args }

}