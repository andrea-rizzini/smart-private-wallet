## ⚠️ Project Deprecated

This project is no longer maintained.  
It has been migrated to [A Private Smart Wallet with Probabilistic Compliance](https://github.com/andrea-rizzini/A-Private-Smart-Wallet-with-Probabilistic-Compliance).
-

# Smart-private-wallet
This project comprises three demos:
1) ```version1_onboarding```, which shows how a private onboarding procedure can be done using notes and commitments
2) ```version2_private_transfers```, which includes everything in version one, plus a protocol based on an utxo-model which allows private transfers in ethereum
3) ```version3_compliance``` under development... this will include everything in version 2, plus a compliance mechanism based on POI (Proof Of Innocence).

# Quickstart:
1) ```npm i``` on the root of the project
2) Make sure to have as many private keys as you need and add them to the .env file  
To test the demo you need at least: two users, a faucet and a relayer; hence at least four private keys
3) Make sure to have enough funds on your faucet
4) Circuits:  
```cd circuits```  
Execute ```./script_v1.sh```  
Execute ```./script_v2.sh 2```  
Execute ```./script_v2.sh 16```  
Execute ```./script_v3.sh 2```  
Execute ```./script_v3.sh 16```  
A folder ```/artifacts``` inside ```/circuits``` will be created with the compiled circom stuff needed to generate zk-proofs and verification, from that folder move ```Verifier2``` and ```Verifier16``` into the folder ```contracts/src/Transfers/```; also move ```VerifierPOI2``` and ```VerifierPOI16``` into the folder ```contracts/src/Compliance/```  
You will have to modifily the .sol files with the correct declaration name, since circom will generate all the verifier contract as ```contract Verifier [...]```  
f.i.: ```VerifierPOI2.sol``` --> ```contract VerifierPOI2 [...]```  
Also rename ```verifyProof``` in ```verifyPOI``` in POI verifier contracts, to avoid collisions in function names.
5) Base contract setup:   
Deploy ```Paymaster``` and ```AccountFactory``` using ```npx hardhat run ./contracts/scripts/deployPaymasterAndAccFactory.ts```    
6) Onboarding mixer setup (for version 1):   
Deploy ```Hasher``` for onboarding mixer using ```npx hardhat run ./contracts/scripts/Onboarding/deployHasherForOnboardingMixer.ts```  
Deploy ```Verifier``` for onboarding mixer using ```npx hardhat run ./contracts/scripts/Onboarding/deployVerifierOnboardingMixer.ts```  
Deploy ```Onboarding mixers``` using ```npx hardhat run ./contracts/scripts/Onboarding/deployOnboardingMixers.ts```  
Create file for caching using ```npx hardhat run ./contracts/scripts/Onboarding/createFileForMixerCaching.ts```
7) UTXOs pool setup (for version 2):   
Deploy ```Pool-users``` using ```npx hardhat run ./contracts/scripts/Transfers/deployPoolUsers.ts```  
Deploy ```Hasher``` for the UTXO-pool using ```npx hardhat run ./contracts/scripts/Transfers/deployHasherForTransactions.ts```  
Deploy ```Verifier2``` and ```Verifier16``` using ```npx hardhat run ./contracts/scripts/Transfers/deployVerifiers.ts```  
Deploy ```UTXOsPool``` using ```npx hardhat run ./contracts/scripts/Transfers/deployUTXOsPool.ts```  
Deploy the ```relayer``` for version2 using  ```npx hardhat run ./contracts/scripts/Transfers/deployRelayer.ts```  
8) UTXOs pool with compliance setup (for version3):  
Deploy ```VerifierPOI2``` and ```VerifierPOI16``` using ```npx hardhat run ./contracts/scripts/Compliance/deployPOIVerifiers.ts```  
Deploy  ```UTXOsPoolWithCompliance``` with ```npx hardhat run ./contracts/scripts/Compliance/deployUTXOsPoolWithCompliance.ts```  
Deploy the ```relayer``` for version3 using  ```npx hardhat run ./contracts/scripts/Compliance/deployRelayer.ts```
9) Initialize databases for each version with:   
```npx hardhat run ./apps/version1_onboarding/database/initialize_db.ts```  
```npx hardhat run ./apps/version2_private_transfers/database/initialize_db.ts```  
```npx hardhat run ./apps/version3_compliance/database/initialize_db.ts```  
Note: a ```.db``` file will be created inside ```/apps/versionX/data/```;  if you want initialize a new database, you just have to execute the script ```npx hardhat run /apps/versionX/database/deleteDB.ts``` and execute again one of the command above, for the version you want deploy the database.
9) Start the version you prefer, from the root of the project, with:  
version_1: ```npx hardhat run ./apps/version1_onboarding/main.ts```  
version_2: ```npx hardhat run ./apps/version2_private_transfers/main.ts```  
version_3: ```npx hardhat run ./apps/version3_compliance/main.ts```

# Demo for version 2 (soon for version 3):
This demo shows all the functionalities of version_1 and version_2.    
You need 2 terminals, T1 and T2.
1) (T1): ```npx hardhat run apps/version2_private_transfers/main.ts```  
2) (T1): type ```1```, type ```testnet``` and chose username (Alice) and password for you account 
3) (T1): in the menu type ```1``` and this will generate a keypair and register its public key into the users pool
4) (T1): in the menu type ```4```, then type ```1``` to receive some eth to your smart-wallet, then insert the amount you want and press enter; make sure to have enough eth for an invitation and then for a send
5) (T1): in the menu type ```3``` to invite someone, select a name (Bob) for him and select the amount you want onboard him with  
6) (T2): ```npx hardhat run apps/version2_private_transfers/main.ts``` 
7) (T2): type ```3``` and wait for the snark proof verification, then chose username (Bob) and password: now you are in
8) (T2): in the menu type ```1``` and this will generate a keypair and register its public key into the users pool
9) (T2): in the menu type ```7``` to verify if the person who invited you is present in the contacts (there should be Alice with her address)
10) (T1): in the menu type ```8``` to refresh, this will check if the note has been redeemed
11) (T1): in the menu type ```7``` to verify if the person you have onboarded is now present in your contacts (there should be Bob with his address)
12) (T1): in the menu type ```4``` and then ```2``` to fund the private amount, then insert the amount you want make private and press enter
13) (T1): in the menu type ```2``` to verify if the utxo has been created
14) (T1): in the menu type ```5```, insert an amount, then you can decide to send to a contact of yours or to send directly inserting the address, finally you can decide if use a relayer for the send
15) (T2): in the menu type ```2``` and verify if you have received the amount sent to you by Alice
16) (T2): in the menu type ```6``` to withdraw specifying the amount you need
17) (T2): in the menu type ```2``` and verify if the withdrawal has gone well

# Notes:
- You can decide to deploy the contracts on the chain you prefer, all you have to do is to modify the file ```hardhat.config.ts``` specifying the RPC_URL and adding the relevant ```PRIVATE_KEYs``` (with the same name you'll specify them on the .env file).  
View the following example:  

```
const config: HardhatUserConfig = {
  defaultNetwork: "base",
  networks: {
    base: {
      url: process.env.RPC_URL_BASE_SEPOLIA!,
      accounts: [
        process.env.PRIVATE_KEY_ALICE!,
        process.env.PRIVATE_KEY_BOB!,
        process.env.PRIVATE_KEY_FAUCET!,
        process.env.PRIVATE_KEY_RELAYER!,
      ],
    },  
```
  
- You need also to specify your etherscan api key in the file ```hardhat.config.ts```:
```
...

etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY, 
  },

...
```
- The solidity version which has been used in the project is version ```0.8.12```, in case you need multiple solidity versions check at: https://hardhat.org/hardhat-runner/docs/advanced/multiple-solidity-versions
- For the version_3, you need to specify in the ```.env``` file an API key for the network you are interfacing with. For instance ```ALCHEMY_API_KEY=qwerty1234```