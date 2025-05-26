# Why version3_flag_propagation_probabilistic:
version3_flag_propagation enables ancestral compliance flagging through a chain state propagation mechanism. To refrain from everinflating memory allocations, especially after the coin merge, we have developed a new version leveraging a bloom filter data structure: version3_flag_propagation_probabilistic.  
A bloom filter is a fixed-size probabilistic data structure designed to test whether an element is a member of a set S. Each element Ĉ (masked commitment) in the set S is processed by k hash functions, each setting a bit to ’1’ in an m-bit array. Membership queries check these k positions if any bit is ’0’, the element is definitely not in the S, while if all bits are ’1’, the element is likely present with a configurable false positive rate. Thus, for k = ln(2)· m/n (where n = |S|), the false positive probability is minimized at 1/2^k .

# How version3_flag_propagation_probabilistic works:
1) Authority Actions: to update the onchain SMT, authorities must provide zero-knowledge proofs (πmask) demonstrating that the masked commitment is derived from a valid original commitment to enforce integrity.  
The proof statement is:  
Let Ĉ = Poseidon(C, b)  
where Ĉ is the masked commitment (public input), C is the original commitment (private input), b is the blinding factor (private input).  
Assert Ĉ = masked commitment.  
When calling the insert function on the SMT contract, the proof πmask will be atomically verified.
2) Private Transfer: to spend their funds, users must decrypts the chain state field of their input UTXOs and fetch StatusFlagged events to check for updates on masked commitments. Before calling transact() via the relayer contract, the user must encrypt the chain state with the recipient’s public key and generate a proof of ancestral compliance (πacc) using the latest SMT root. This proof is included in the calldata to demonstrate that a flagged ancestral commitment Ĉ contained in the SMT is not a member of the bloom filter that encodes the private UTXO chain state. Since more than one flagging event might occur during in-between internal transfers, this translates to: ∀Ĉ ∈ SMT, Ĉ ∈ / S.

# Quickstart for version3_flag_propagation_probabilistic:
1) ```npm i``` on the root of the project
2) Make sure to have as many private keys as you need and add them to the .env file  
To test the demo you need: two users, a faucet and a relayer; hence at least four private keys
3) Make sure to have enough funds on your faucet
4) Circuits setup:  
```cd circuits```  
Execute ```./script_v2.sh 2```  
Execute ```./script_v2.sh 16```   
Execute ```./script_v3_probabilistic.sh```  
A folder ```/artifacts``` inside ```/circuits``` will be created with the compiled circom stuff needed to generate zk-proofs and verification, from that folder move ```Verifier2.sol```, ```Verifier16.sol``` into the folder ```contracts/src/Transfer/```, ```VerifierNonMembershipBloom.sol``` into the folder ```contracts/src/FlagPropagationProbabilisic/```  and ```VerifierMaskCommitment.sol``` into the folder ```contracts/src/FlagPropagation/```   
5) Base contract setup:   
Deploy ```Paymaster``` and ```AccountFactory```. Uncomment the useful part of code and use ```npx hardhat run ./contracts/scripts/deployPaymasterAndAccFactory.ts```    
6) Mixer setup:    
Deploy ```Authority``` using  ```npx hardhat run ./contracts/scripts/FlagPropagation/deployAuthority.ts```  
Deploy ```Relayer``` using  ```npx hardhat run ./contracts/scripts/FlagPropagationProbabilistic/deployRelayerForV3Probabilistic.ts```  
Deploy ```PoolUsers``` using ```npx hardhat run ./contracts/scripts/Transfers/deployPoolUsers.ts```  
Deploy ```EncryptedDataOnboardedUsers ``` using ```npx hardhat run ./contracts/scripts/Transfers/deployEncryptedDataOnboardedUsers.ts```
Deploy ```Hasher``` for the mixer using ```npx hardhat run ./contracts/scripts/Transfers/deployHasherForTransactions.ts```  
Deploy ```Poseidon3Inputs``` for the mixer using ```npx hardhat run ./contracts/scripts/FlagPropagation/deployPoseidon3Inputs.ts```  

Deploy ```Verifier2``` and ```Verifier16``` using ```npx hardhat run ./contracts/scripts/Transfers/deployVerifiers.ts```  
Deploy ```VerifierMaskCommitment```using ```npx hardhat run ./contracts/scripts/FlagPropagation/deployVerifierMaskCommitment.ts``` 
Deploy ```VerifierNonMembershipBloom```using ```npx hardhat run ./contracts/scripts/FlagPropagationProbabilistic/deployVerifierNonMembershipBloom.ts```  
Deploy ```MixerOnboardingAndTransfersV3Probabilistic``` using ```npx hardhat run ./contracts/scripts/FlagPropagationProbabilistic/deployMixerOnboardingAndTransfersV3Probabilistic.ts```  

You need 2 terminals, T1, T2 and T3.
1) (T1): ```npx hardhat run apps/version3_flag_propagation_probabilistic/main.ts```  
2) (T1): type ```1```, type ```testnet``` and choose username (Alice) and password for your account: you will be fund in seconds with 0.01 USDC from the faucet.
3) (T1): type  ```1``` to check your smart contract address and your private balance
4) (T1): in the menu type ```2``` to invite someone, select a name (Bob) for him and select the amount you want onboard him with. You can check your amount after having spent funds to onboard Bob typing  ```1```.
5) (T2): ```npx hardhat run apps/version3_flag_propagation_probabilistic/main.ts``` 
6) (T2): type ```3```, choose username (Bob) and password and wait for the onboarding to be complete: now you are in.
7) (T2): in the menu type ```6``` to verify if the person who invited you is present in the contacts (there should be Alice with her address).
8) (T1): in the menu type ```7``` to refresh, this will check if the user has completed the onboarding procedure. 
9) (T1): in the menu type ```6``` to verify if the person you have onboarded is now present in your contacts (there should be Bob with his address).  
This is the basic setup where Bob has received a UTXO from Alice. Now, let's suppose Alice's address becomes sanctioned:
10) Add Alice's address in ```apps/version3_flag_propagation/sanctioned_addresses/sanctioned_addresses.json```
11) (T3): ```npx hardhat run apps/version3_flag_propagation/src/authority/authority_check.ts```, now the masked commitment related to Alice will be appended on the Sparse Merkle Tree of the authority.
12) (T2): in the menu type ```4``` and send back to Alice 0.01 USDC --> You will be blocked because the proof of non-membership of that UTXO in the SMT will not pass. Here, a burning/locking mechanism should be implemented so that Bob can exclude the tainted UTXO from his UTXOs.
7) Initialize the database:   
```npx hardhat run ./apps/version3_flag_propagation_probabilistic/database/initialize_db.ts``` 
Note: a ```.db``` file will be created inside ```/apps/version3_flag_propagation_probabilistic/data/```;  if you want initialize a new database, you just have to execute the script ```npx hardhat run /apps/version3_flag_propagation_probabilistic/database/deleteDB.ts``` and execute again the command above.
9) Start the program from the root of the project, with:
 ```npx hardhat run ./apps/version3_flag_propagation_probabilistic/main.ts```  

# Demo for version3_flag_propagation_probabilistic:
You need 2 terminals, T1, T2 and T3.
1) (T1): ```npx hardhat run apps/version3_flag_propagation_probabilistic/main.ts```  
2) (T1): type ```1```, type ```testnet``` and choose username (Alice) and password for your account: you will be fund in seconds with 0.01 USDC from the faucet.
3) (T1): type  ```1``` to check your smart contract address and your private balance
4) (T1): in the menu type ```2``` to invite someone, select a name (Bob) for him and select the amount you want onboard him with. You can check your amount after having spent funds to onboard Bob typing  ```1```.
5) (T2): ```npx hardhat run apps/version3_flag_propagation_probabilistic/main.ts``` 
6) (T2): type ```3```, choose username (Bob) and password and wait for the onboarding to be complete: now you are in.
7) (T2): in the menu type ```6``` to verify if the person who invited you is present in the contacts (there should be Alice with her address).
8) (T1): in the menu type ```7``` to refresh, this will check if the user has completed the onboarding procedure. 
9) (T1): in the menu type ```6``` to verify if the person you have onboarded is now present in your contacts (there sh<ould be Bob with his address).  
This is the basic setup where Bob has received a UTXO from Alice. Now, let's suppose Alice's address becomes sanctioned:
10) Add Alice's address in ```apps/version3_flag_propagation_probabilistic/sanctioned_addresses/sanctioned_addresses.json```
11) (T3): ```npx hardhat run apps/version3_flag_propagation_probabilistic/src/authority/authority_check.ts```, now the masked commitment related to Alice will be appended on the Sparse Merkle Tree of the authority.
12) (T2): in the menu type ```4``` and send back to Alice 0.01 USDC --> You will be blocked since the proof of non-membership of that UTXO in the bloom filter will not pass. Here, a burning/locking mechanism should be implemented so that Bob can exclude the tainted UTXO from his UTXOs.