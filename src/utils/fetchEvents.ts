import fs from 'fs';
import path from 'path';
import hre from "hardhat";
import { get_deployment_block } from './getDeploymentBlock';
require("dotenv").config();

const ONBOARDING_MIXER_ADDRESS_TEST = process.env.ONBOARDING_MIXER_ADDRESS_TEST || '';
const ONBOARDING_MIXER_ADDRESS_LOW = process.env.ONBOARDING_MIXER_ADDRESS_LOW || '';
const ONBOARDING_MIXER_ADDRESS_MEDIUM = process.env.ONBOARDING_MIXER_ADDRESS_MEDIUM || '';
const ONBOARDING_MIXER_ADDRESS_HIGH = process.env.ONBOARDING_MIXER_ADDRESS_HIGH || '';

let contract: any, deployedBlockNumber: number | undefined;

async function initJson(file: fs.PathOrFileDescriptor) {
  return new Promise((resolve, reject) => {
    fs.readFile(file, 'utf8', (error, data) => {
      if (error) {
        resolve([]);
      }
      try {
        resolve(JSON.parse(data));
      } catch (error) {
        resolve([]);
      }
    });
  });
};

function capitalizeFirstLetter(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

async function loadCachedEvents({ type, currency, amount }: { type: string, currency: string, amount: number }) {
    try {

      const dirPath = path.join(__dirname, '../../cache/');
      const fileName = `${type}_${currency}_${amount}.json`;
      const filePath = path.join(dirPath, fileName);
      const module = require(filePath);
  
      if (module) {
        const events = module;

        switch(amount) { 
          case 0.01:
            contract = await hre.ethers.getContractAt("OnboardingMixer", ONBOARDING_MIXER_ADDRESS_TEST);
              break;
          case 0.1:
              contract = await hre.ethers.getContractAt("OnboardingMixer", ONBOARDING_MIXER_ADDRESS_LOW);
              break;
          case 1:
              contract = await hre.ethers.getContractAt("OnboardingMixer", ONBOARDING_MIXER_ADDRESS_MEDIUM);
              break;
          case 10:
              contract = await hre.ethers.getContractAt("OnboardingMixer", ONBOARDING_MIXER_ADDRESS_HIGH);
              break;
        }

        return {
          events,
          lastBlock: events[events.length - 1].blockNumber
        }
      }
    } catch (err) {
      switch(amount) {
        case 0.01:
            deployedBlockNumber = await get_deployment_block(ONBOARDING_MIXER_ADDRESS_TEST); 
            contract = await hre.ethers.getContractAt("OnboardingMixer", ONBOARDING_MIXER_ADDRESS_TEST);
            break;
        case 0.1:
            deployedBlockNumber = await get_deployment_block(ONBOARDING_MIXER_ADDRESS_LOW);
            contract = await hre.ethers.getContractAt("OnboardingMixer", ONBOARDING_MIXER_ADDRESS_LOW);
            break;
        case 1:
            deployedBlockNumber = await get_deployment_block(ONBOARDING_MIXER_ADDRESS_MEDIUM);
            contract = await hre.ethers.getContractAt("OnboardingMixer", ONBOARDING_MIXER_ADDRESS_MEDIUM);
            break;
        case 10:
            deployedBlockNumber = await get_deployment_block(ONBOARDING_MIXER_ADDRESS_HIGH);
            contract = await hre.ethers.getContractAt("OnboardingMixer", ONBOARDING_MIXER_ADDRESS_HIGH);
            break;
      }
      console.log("\nError fetching cached files, syncing from block", deployedBlockNumber);
      return {
        events: [],
        lastBlock: deployedBlockNumber, 
      }
    }
  }

// todo: add a control of the last block number (if present) in the cache file, and statrt fetching from there

export async function fetchEvents({ type, currency, amount }: { type: string, currency: string, amount: number }) {
    if (type === "CommitmentCreated") {
      type = "CommitmentCreated";
    }
  
    const cachedEvents: any = await loadCachedEvents({ type, currency, amount }) ;

    let startBlock: number;

    if (cachedEvents.events.length === 0) {
        startBlock = cachedEvents.lastBlock;
    }
    else {
        startBlock = cachedEvents.lastBlock + 1;
    }

    console.log("\nLoaded cached",amount,currency.toUpperCase(),type,"events for",startBlock,"block");
    console.log("Fetching",amount,currency.toUpperCase(),type,"events for base-sepolia network");
  
    async function syncEvents() {
      try {
        let targetBlock = await hre.ethers.provider.getBlockNumber(); // most recent block number
        let chunks = 1000;
        console.log("\nQuerying latest events from RPC");

        let i : number;
  
        for (i = startBlock; i < targetBlock; i += chunks) {
          let fetchedEvents: any [] = [];
  
          function mapCommitmentCreatedEvents() {
            fetchedEvents = fetchedEvents.map(({ blockNumber, transactionHash, args }) => {
              const { commitment, leafIndex, timestamp } = args;
              return {
                blockNumber,
                transactionHash,
                commitment,
                leafIndex: Number(leafIndex),
                timestamp: Number(timestamp)
              }
            });
          }
  
          function mapWithdrawEvents() {
            fetchedEvents = fetchedEvents.map(({ blockNumber, transactionHash, returnValues }) => {
              const { nullifierHash, to, fee } = returnValues;
              return {
                blockNumber,
                transactionHash,
                nullifierHash,
                to,
                fee
              }
            });
          }
  
          function mapLatestEvents() {
            if (type === "CommitmentCreated"){
              mapCommitmentCreatedEvents();
            } else {
              mapWithdrawEvents();
            }
          }
  
          async function fetchWeb3Events(i: number) {
            let j;
            if (i + chunks - 1 > targetBlock) {
              j = targetBlock;
            } else {
              j = i + chunks - 1;
            }
            
            await contract.queryFilter(capitalizeFirstLetter(type), i, j).then((r: any) => { fetchedEvents = fetchedEvents.concat(r); console.log("Fetched", amount, currency.toUpperCase(), type, "events to block:", j) }, (err: any) => { console.error(i + " failed fetching", type, "events from node", err); process.exit(1); }).catch(console.log);

            if (type === "CommitmentCreated"){
              mapCommitmentCreatedEvents();
            } else {
              mapWithdrawEvents();
            }
          }
  
          async function updateCache() {
            try {
              const dirPath = path.join(__dirname, '../../cache/');
              const fileName = `${type}_${currency}_${amount}.json`;
              const filePath = path.join(dirPath, fileName);
              
              const localEvents: any = await initJson(filePath);
              const events = localEvents.concat(fetchedEvents);
              fs.writeFileSync(filePath, JSON.stringify(events, null, 2), 'utf8');
            } catch (error) {
              throw new Error('Writing cache file failed');
            }
          }
          await fetchWeb3Events(i);
          await updateCache();
        }
      } catch (error) {
        throw new Error("Error while updating cache");
        process.exit(1);
      }
    }

    await syncEvents();
  
    async function loadUpdatedEvents() {
      const dirPath = path.join(__dirname, '../../cache/');
      const fileName = `${type}_${currency}_${amount}.json`;
      const filePath = path.join(dirPath, fileName);
      const updatedEvents: any = await initJson(filePath);
      const updatedBlock = updatedEvents[updatedEvents.length - 1].blockNumber;
      console.log("\nCache updated for ",type,amount,currency,"instance to block",updatedBlock,"successfully");
      console.log(`\nTotal ${type}s:`, updatedEvents.length);
      return updatedEvents;
    }
    const events = await loadUpdatedEvents();
    return events;
  }
