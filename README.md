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
Execute ```./circuit/script_v1.sh```  
Execute ```./circuit/script_v2.sh 2```  
Execute ```./circuit/script_v2.sh 16```  
A folder ```/artifacts``` inside ```/circuits``` will be created with the compiled circom stuff needed to generate zk-proofs and verification, from that folder move ```Verifier2``` and ```Verifier16``` into the folder ```contracts/src/Transfers/``` being sure to modify the contract declaration inside the .sol files.
5) Base contract setup:   
Deploy ```Paymaster``` and ```AccountFactory``` using ```./contracts/scripts/deployPaymasterAndAccFactory.ts```    
6) Onboarding mixer setup:   
Deploy ```Hasher``` for onboarding mixer using ```./contracts/scripts/Onboarding/deployHasherForOnboardingMixer.ts```  
Deploy ```Verifier``` for onboarding mixer using ```./contracts/scripts/Onboarding/deployVerifierOnboardingMixer.ts```  
Deploy ```Onboarding mixers``` using ```./contracts/scripts/Onboarding/deployOnboardingMixers.ts```  
Create file for caching using ```./contracts/scripts/Onboarding/createFileForMixerCaching.ts```
7) UTXOs pool setup:   
Deploy ```Pool-users``` using ```./contracts/scripts/Transfers/deployPoolUsers.ts```  
Deploy ```Hasher``` for the UTXO-pool using ```./contracts/scripts/Transfers/deployHasherForTransactions.ts```  
Deploy ```Verifier``` for the UTXO-pool using ```./contracts/scripts/Transfers/deployVerifiers.ts```  
Deploy ```UTXO-pool``` using ```./contracts/scripts/Transfers/deployUTXOsPool.ts```  
Deploy the ```relayer``` using  ```./contracts/scripts/Transfers/deployRelayer.ts```   
8) Start the version you prefer, from the root of the project, with:  
version_1: ```npx hardhat run /apps/version1_onboarding/main.ts```  
version_2: ```npx hardhat run /apps/version2_private_transfers/main.ts```  
version_3: ```npx hardhat run /apps/version3_compliance/main.ts``` 

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