import fs from 'fs';
import path from 'path';
import hre from "hardhat";
import { get_deployment_block } from './getDeploymentBlock';
require("dotenv").config();

const MIXER_ONBOARDING_AND_TRANSFERS = process.env.MIXER_ONBOARDING_AND_TRANSFERS || '';

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

async function loadCachedEvents() {
    try {

      const dirPath = path.join(__dirname, '../../cache/');
      const fileName = `CommitmentCreated_arbitrary_denom.json`;
      const filePath = path.join(dirPath, fileName);
      const module = require(filePath);
  
      if (module) {
        const events = module;
        contract = await hre.ethers.getContractAt("MixerOnboardingAndTransfers", MIXER_ONBOARDING_AND_TRANSFERS);

        return {
          events,
          lastBlock: events[events.length - 1].blockNumber
        }
      }
    } catch (err) {
      deployedBlockNumber = await get_deployment_block(MIXER_ONBOARDING_AND_TRANSFERS);
      contract = await hre.ethers.getContractAt("MixerOnboardingAndTransfers", MIXER_ONBOARDING_AND_TRANSFERS);
      console.log("\nError fetching cached files, syncing from block", deployedBlockNumber);
      return {
        events: [],
        lastBlock: deployedBlockNumber, 
      }
    }
  }


export async function fetchEvents({ type}: { type: string}) {

    console.log("\nFetching events ...")

    if (type === "CommitmentCreated") {
      type = "CommitmentCreated";
    }
  
    const cachedEvents: any = await loadCachedEvents() ;

    let startBlock: number;

    if (cachedEvents.events.length === 0) {
        startBlock = cachedEvents.lastBlock;
    }
    else {
        startBlock = cachedEvents.lastBlock + 1;
    }
  
    async function syncEvents() {
      try {
        let targetBlock = await hre.ethers.provider.getBlockNumber(); // most recent block number
        let chunks = 1000;

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
            
            await contract.queryFilter(capitalizeFirstLetter(type), i, j).then((r: any) => { fetchedEvents = fetchedEvents.concat(r); }, (err: any) => { console.error(i + " failed fetching", type, "events from node", err); process.exit(1); }).catch(console.log);

            if (type === "CommitmentCreated"){
              mapCommitmentCreatedEvents();
            } else {
              mapWithdrawEvents();
            }
          }
  
          async function updateCache() {
            try {
              const dirPath = path.join(__dirname, '../../cache/');
              const fileName = `CommitmentCreated_arbitrary_denom.json`;
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
      const fileName = `CommitmentCreated_arbitrary_denom.json`;
      const filePath = path.join(dirPath, fileName);
      const updatedEvents: any = await initJson(filePath);
      const updatedBlock = updatedEvents[updatedEvents.length - 1].blockNumber;
      return updatedEvents;
    }
    const events = await loadUpdatedEvents();
    return events;
  }
