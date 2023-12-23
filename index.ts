import { Connection, Keypair, VersionedTransaction } from "@solana/web3.js";
import { Wallet } from "@project-serum/anchor";

import bs58 from "bs58";
import fs from "fs";

import { runPythonScriptAndSaveOutput } from './src/weights/pythonRunner';

import { PublicKey } from '@solana/web3.js';

//instead of main() directly ,we use schedule to run with cron
const cron = require('node-cron');
require('dotenv').config();


const RPC_URL = "https://api.mainnet-beta.solana.com";

async function main() {
    
    //RPC endpoint
    const connection = new Connection(RPC_URL);
    const network = 'solana';

    try {
        const recentWeightsJson = await runPythonScriptAndSaveOutput('/Volumes/work/blockchain/solana/bot_ts-main/python/weights_ts.py', [], '/Volumes/work/blockchain/solana/bot_ts-main/python/recent_weights.json');
        console.log(recentWeightsJson); 
    } catch (error) {
        console.error(error);
        return; // Exit the function if the Python script fails
    }


}
