import dotenv from 'dotenv';
import fs from 'fs';
import hre from "hardhat";

const EP_ADDRESS: string = process.env.ENTRY_POINT_ADDRESS || '';
const ACCOUNT_FACTORY_V3_AUTHORITY_ADDRESS: string = process.env.ACCOUNT_FACTORY_V3_AUTHORITY_ADDRESS || '';

async function main() {

    const envConfig = dotenv.parse(fs.readFileSync('.env'));

    // deploy the authority
    const AccountFactory = await hre.ethers.getContractFactory("contracts/src/FlagPropagation/Authority.sol:AccountFactory"); 
    const signers = await hre.ethers.getSigners(); 
    const address = await signers[4].getAddress(); 

    const ep = await hre.ethers.getContractAt("EntryPoint", EP_ADDRESS, signers[2]);

    let initCode = ACCOUNT_FACTORY_V3_AUTHORITY_ADDRESS + AccountFactory.interface.encodeFunctionData("createAccount", [address]).slice(2);
    let authority: string = "0x";
    try {
        await ep.getSenderAddress(initCode);
    }
    catch (error: any) {
        authority = "0x" + error.data.slice(-40); 
    }
    
    const code = await hre.ethers.provider.getCode(authority); 
    if (code !== "0x") {
        initCode = "0x";
    }

    const _authority = await hre.ethers.getContractAt("contracts/src/FlagPropagation/Authority.sol:Authority", authority);
    console.log("Authority:", authority);

    envConfig.AUTHORITY_ADDRESS = authority.toString();
    envConfig.INIT_CODE_AUTHORITY = initCode.toString();
    const updatedEnv = Object.entries(envConfig).map(([key, value]) => `${key}=${value}`).join('\n');
    fs.writeFileSync('.env', updatedEnv);

}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});