# Why version3_flag_propagation:
This idea emerged when we asked ourselves: what if one of the depositors becomes sanctioned according to a public sanctions list, like one maintained by OFAC? How is it possible to inform people that they have received a UTXO which comes from an illicit address? Since we have visibility into who deposits in the mixer, an authority could verify whether an address remains “clean” (as we block deposits from addresses flagged as sanctioned at the time of deposit) or if it has become sanctioned at a later date. Based on this concern, we have formalized a system that can verify received UTXOs through a backtracking mechanism, allowing for verification without revealing the original deposit source.

# How version3_flag_propagation works:
Here’s a high-level overview: each deposit commitment will be associated with a masked commitment stored in an off-chain structure maintained by an authority. This masked commitment is transmitted in each transaction where a UTXO stemming from that deposit appears. The authority regularly performs a transitivity check on each entry in this off-chain structure. If, at any point, a deposit address becomes sanctioned, the corresponding masked commitment will be disclosed. This allows any user to determine if they are involved in the transfer of funds originating from that now-tainted UTXO.

# Quickstart for version3_flag_propagation:
1) ```npm i``` on the root of the project
2) Make sure to have as many private keys as you need and add them to the .env file  
To test the demo you need at least: two users, a faucet and a relayer; hence at least four private keys
3) Make sure to have enough funds on your faucet
4) Circuits setup:  
```cd circuits```  
Execute ```./script_v2.sh 2```  
Execute ```./script_v2.sh 16```   
Execute ```./script_v3.sh```  
A folder ```/artifacts``` inside ```/circuits``` will be created with the compiled circom stuff needed to generate zk-proofs and verification, from that folder move ```Verifier2.sol```, ```Verifier16.sol``` into the folder ```contracts/src/Compliance/```  and ```VerifierNonMembership.sol```, ```VerifierMaskCommitment.sol``` into the folder ```contracts/src/FlagPropagation/```  
You will have to modify the .sol files with the correct declaration name, since circom will generate all the verifier contract as ```contract Verifier [...]```  
```Verifier2.sol``` : ```contract Verifier [...]``` --> ```contract Verifier2 [...]```  
```Verifier16.sol``` : ```contract Verifier [...]``` --> ```contract Verifier16 [...]```  
```VerifierMaskCommitment.sol``` : ```contract Verifier [...]``` --> ```contract VerifierMaskCommitment [...]```  
```VerifierNonMembership.sol``` : ```contract Verifier [...]``` --> ```contract VerifierNonMembership [...]```  
Rename ```verifyProof``` in ```verifyProofNonMembership``` in ```VerifierNonMembership.sol``` contract.  
Rename ```verifyProof``` in ```verifyProofMaskCommitment``` in ```VerifierMaskCommitment.sol``` contract.  
5) Base contract setup:   
Deploy ```Paymaster``` and ```AccountFactory``` using ```npx hardhat run ./contracts/scripts/deployPaymasterAndAccFactory.ts```    
6) Mixer setup:    
Deploy ```Authority``` for using  ```npx hardhat run ./contracts/scripts/FlagPropagation/deployAuthority.ts```  
Deploy ```Relayer``` for version3 using  ```npx hardhat run ./contracts/scripts/FlagPropagation/deployRelayerForV3.ts```  
Deploy ```PoolUsers``` using ```npx hardhat run ./contracts/scripts/Transfers/deployPoolUsers.ts```  
Deploy ```EncryptedDataOnboardedUsers ``` using ```npx hardhat run ./contracts/scripts/Transfers/deployEncryptedDataOnboardedUsers.ts```
Deploy ```Hasher``` for the mixer using ```npx hardhat run ./contracts/scripts/Transfers/deployHasherForTransactions.ts```  
Deploy ```Poseidon3Inputs``` for the mixer using ```npx hardhat run ./contracts/scripts/FlagPropagation/deployPodeison3Inputs.ts```  
Deploy ```Verifier2``` and ```Verifier16``` using ```npx hardhat run ./contracts/scripts/Transfers/deployVerifiers.ts```  
Deploy ```VerifierMaskCommitment```using ```npx hardhat run ./contracts/scripts/FlagPropagation/deployVerifierMaskCommitment.ts``` 
Deploy ```VerifierNonMembership```using ```npx hardhat run ./contracts/scripts/FlagPropagation/deployVerifierNonMembership.ts``` 
Deploy ```MixerOnboardingAndTransfersV3``` using ```npx hardhat run ./contracts/scripts/FlagPropagation/deployMixerOnboardingAndTransfersV3.ts```  

7) Initialize the database:   
```npx hardhat run ./apps/version3_flag_propagation/database/initialize_db.ts``` 
Note: a ```.db``` file will be created inside ```/apps/version3_flag_propagation/data/```;  if you want initialize a new database, you just have to execute the script ```npx hardhat run /apps/version3_flag_propagation/database/deleteDB.ts``` and execute again the command above.
9) Start the program from the root of the project, with:
 ```npx hardhat run ./apps/version3_flag_propagation/main.ts```  

# Demo for version3_flag_propagation: