import { Connection, Keypair, VersionedTransaction } from "@solana/web3.js";
import { runPythonScriptAndSaveOutput } from './src/weights/pythonRunner';
import path from 'path';

const cron = require('node-cron');
require('dotenv').config();

const RPC_URL = "https://api.mainnet-beta.solana.com";

async function main() {
    //RPC endpoint
    const connection = new Connection(RPC_URL);
    const network = 'solana';
    console.log("test");
    try {
        
        const pathIn = path.join(__dirname, 'src/weights/weights.py');
        const pathOut1 = path.join(__dirname, 'weightResults', 'generated_weights.json');
        const pathOut2 = path.join(__dirname, 'generated_weights.json');
        const recentWeightsJson = await runPythonScriptAndSaveOutput(pathIn, [__dirname], pathOut1, pathOut2); // Writes to two files
        
        // Or with one output path:
        // const recentWeightsJson = await runPythonScriptAndSaveOutput(pathIn, [__dirname], pathOut1); // Writes to one file
        
        // Or with no output paths:
        // const recentWeightsJson = await runPythonScriptAndSaveOutput(pathIn, [__dirname]); // Writes to no files
        
    } catch (error) {
        console.error(error);
        return; // Exit the function if the Python script fails
    }
    console.log("test 2");
}

main().catch(err => console.error(err));