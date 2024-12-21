
import dotenv from 'dotenv';
import fs from 'fs';
import hre from "hardhat";

const EP_ADDRESS: string = process.env.ENTRY_POINT_ADDRESS || '';
const ACCOUNT_FACTORY_V3_RELAYER_PROBABILISTIC_ADDRESS: string = process.env.ACCOUNT_FACTORY_V3_RELAYER_PROBABILISTIC_ADDRESS || '';

async function main() {

    const envConfig = dotenv.parse(fs.readFileSync('.env'));

    // deploy the relayer
    const AccountFactory = await hre.ethers.getContractFactory("contracts/src/FlagPropagationProbabilistic/RelayerForV3Probabilistic.sol:AccountFactory"); 
    const signers = await hre.ethers.getSigners(); // signers[i] is the whole object
    const address = await signers[3].getAddress(); 

    const ep = await hre.ethers.getContractAt("EntryPoint", EP_ADDRESS, signers[2]);

    let initCode = ACCOUNT_FACTORY_V3_RELAYER_PROBABILISTIC_ADDRESS + AccountFactory.interface.encodeFunctionData("createAccount", [address]).slice(2);
    let relayer: string = "0x";
    try {
        await ep.getSenderAddress(initCode);
    }
    catch (error: any) {
        relayer = "0x" + error.data.slice(-40); 
    }
    
    const code = await hre.ethers.provider.getCode(relayer); 
    if (code !== "0x") {
        initCode = "0x";
    }

    const _relayer = await hre.ethers.getContractAt("contracts/src/FlagPropagationProbabilistic/RelayerForV3Probabilistic.sol:Relayer", relayer);
    console.log("Relayer for V3 probabilistic:", relayer);

    envConfig.RELAYER_V3_PROBABILISTIC_ADDRESS = relayer.toString();
    envConfig.INIT_CODE_RELAYER_V3_PROBABILISTIC = initCode.toString();
    const updatedEnv = Object.entries(envConfig).map(([key, value]) => `${key}=${value}`).join('\n');
    fs.writeFileSync('.env', updatedEnv);

}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});