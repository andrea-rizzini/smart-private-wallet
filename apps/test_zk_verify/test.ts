import { AccountInfo } from 'zkverifyjs/dist/types';
import { zkVerifySession, ZkVerifyEvents, TransactionStatus, VerifyTransactionInfo } from 'zkverifyjs';
import { VKRegistrationTransactionInfo } from 'zkverifyjs/dist/types';

async function executeVerificationTransaction(proof: unknown, publicSignals: unknown, vk: unknown) {
    const session = await zkVerifySession.start()
        .Testnet()
        .withAccount('sibling dismiss pledge clown faculty notable coin rail buddy produce critic achieve');

    // const accountInfo: AccountInfo = await session.accountInfo();
    // console.log(accountInfo.address);
    // console.log(accountInfo.nonce);
    // console.log(accountInfo.freeBalance);
    // console.log(accountInfo.reservedBalance);

    // verify the proof
    const {events, transactionResult} = await session.verify()
        .groth16()
        .withRegisteredVk()                                
        .nonce(1)                                  
        .waitForPublishedAttestation()                                
        .execute({ proofData: { 
            vk: vk,
            proof: proof,
            publicSignals: publicSignals }
        })

    const transactionInfo: VerifyTransactionInfo = await transactionResult;

    console.log(transactionInfo.attestationConfirmed); // Expect 'true'
    console.log(JSON.stringify(transactionInfo.attestationEvent)) // Attestation Event details.

}


const proof = /* Your proof data */;
const publicSignals = /* Your public signals */;
const vk = /* Your verification key */;

// Execute the transaction
executeVerificationTransaction(proof, publicSignals, vk);