import hre from "hardhat";

import { createOnboardingData, createTransactionData, getAccountAddress, getUserAccountInfo } from "./poolFunctions";
import { Keypair } from "./keypair";
import { Utxo } from "./utxo";

export async function prepareDeposit(amount: string, address: string, signer: any){
  const recipientAddress = await getAccountAddress(address)
  if (recipientAddress) {
    const keypair = Keypair.fromString(recipientAddress);
    const output = new Utxo({ amount: hre.ethers.parseUnits(amount, 6), keypair })
    const { extData, args } = await createTransactionData({ outputs: [output] }, keypair, signer)
    return { args, extData }
  } else {
    console.log('Recipient not found');
  }  
}

export async function prepareTransferForOnboarding(amount: string, recipientUtxoOnboarding: Utxo, username: string, addressSender: string, signer: any) {

  const { unspentUtxo, totalAmount, senderKeyPair } = await getUserAccountInfo(username, addressSender, {amount: hre.ethers.parseUnits(amount, 6)})

  const senderChangeUtxo = new Utxo({
    keypair: senderKeyPair,
    amount: totalAmount - (hre.ethers.parseUnits(amount, 6)),
  })

  const outputs = (totalAmount - (hre.ethers.parseUnits(amount, 6))) == BigInt(0) ? [recipientUtxoOnboarding] : [recipientUtxoOnboarding, senderChangeUtxo]

  const { extData, args } = await createOnboardingData({ outputs, inputs: unspentUtxo }, senderKeyPair, signer)
  return { args, extData }
}

export async function prepareTransfer(amount: string, username: string, addressSender: string, addressReceiver: string, signer: any) {
  const recipientAddress = await getAccountAddress(addressReceiver)
  if (recipientAddress) {

    const recipientUtxo = new Utxo({
      amount: hre.ethers.parseUnits(amount, 6),
      keypair: Keypair.fromString(recipientAddress),
    })
    
    const { unspentUtxo, totalAmount, senderKeyPair } = await getUserAccountInfo(username, addressSender, {amount: hre.ethers.parseUnits(amount, 6)})
    
    if (totalAmount < (hre.ethers.parseUnits(amount, 6))) {
      throw new Error(`Insufficient funds!`)
    }

    const senderChangeUtxo = new Utxo({
      keypair: senderKeyPair,
      amount: totalAmount - (hre.ethers.parseUnits(amount, 6)),
    })

    const outputs = (totalAmount - (hre.ethers.parseUnits(amount, 6))) == BigInt(0) ? [recipientUtxo] : [recipientUtxo, senderChangeUtxo]

    const { extData, args } = await createTransactionData({ outputs, inputs: unspentUtxo }, senderKeyPair, signer)
    return { args, extData }


  } else {
    console.log('\nRecipient not registered in the pool');
  }  
} 

export async function prepareWithdrawal(amount: string, username: string, addressSender: string, addressReceiver: string, signer: any) {

  const { unspentUtxo, totalAmount, senderKeyPair } = await getUserAccountInfo(username, addressSender, {amount: hre.ethers.parseUnits(amount, 6)})

  const outputs = [new Utxo({ amount: totalAmount - (hre.ethers.parseUnits(amount, 6)), keypair: senderKeyPair })]

  const { extData, args } = await createTransactionData(
    {
      outputs,
      inputs: unspentUtxo,
      recipient: addressReceiver,
    },
    senderKeyPair,
    signer
  )
  return { extData, args }

}