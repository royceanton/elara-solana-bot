/**
 * Creates and updates the tokens.json file with token data from an API and a whitelist.
 * 
 * @returns {Promise<void>} A promise that resolves when the tokens.json file has been successfully updated.
 */
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '../../.env') });

interface Token {
    address: string;
    decimals: number;
    name: string;
    symbol: string;
    manual?: boolean;
}

async function createTokensJson() {
    const sortTypes = ['v24hChangePercent', 'v24hUSD', 'mc'];
    let newTokens: Token[] = [];

    // Read the whitelist from the file
    const whitelistFilePath = path.join(__dirname, '../../whitelist.json');
    const whitelistData = await fs.promises.readFile(whitelistFilePath, 'utf-8');
    const whitelist = JSON.parse(whitelistData);

    for (const sortType of sortTypes) {
        // Fetch the token data from the API
        const options = {
            method: 'GET',
            headers: {'x-chain': 'solana', 'X-API-KEY': process.env.BIRDEYE_API_KEY || ''}
        };
        const response = await fetch(`https://public-api.birdeye.so/public/tokenlist?sort_by=${sortType}&sort_type=desc`, options);
        const tokenData = await response.json();

        // Save the token data to a local file
        const tokensFilePath = path.join(__dirname, `./data/tokens_${sortType}.json`);
        await fs.promises.mkdir(path.dirname(tokensFilePath), { recursive: true });
        await fs.promises.writeFile(tokensFilePath, JSON.stringify(tokenData, null, 2));

        // Filter out the tokens you're interested in and set 'manual' to false
        const filteredTokens = tokenData.data.tokens
        .filter((token: Token) => token.symbol && whitelist.includes(token.symbol.toUpperCase()))
        .map((token: Token) => ({
            address: token.address,
            decimals: token.decimals,
            name: token.name,
            symbol: token.symbol,
            manual: false
        }));

        newTokens = [...newTokens, ...filteredTokens];
    }

    // Load the existing tokens.json
    const tokensJsonFilePath = path.join(__dirname, '../../tokens.json');
    let tokensJson: Token[] = [];
    try {
        const tokensJsonData = await fs.promises.readFile(tokensJsonFilePath, 'utf-8');
        tokensJson = JSON.parse(tokensJsonData);
    } catch (err) {
        console.log('No existing tokens.json found. A new one will be created.');
    }

    // Merge the new tokens with the existing tokens.json
    const mergedTokensJson = [...tokensJson];
    for (const newToken of newTokens) {
        const index = mergedTokensJson.findIndex(token => token.symbol === newToken.symbol);
        if (index !== -1) {
            if (!mergedTokensJson[index].manual) {
                // Overwrite the existing token data if it's not marked as 'manual'
                mergedTokensJson[index] = newToken;
            }
        } else {
            // Add the new token data
            mergedTokensJson.push(newToken);
        }
    }

    // Sort the merged tokens.json so that 'manual' entries appear first
    mergedTokensJson.sort((a, b) => (b.manual ? 1 : 0) - (a.manual ? 1 : 0));

    // Save the updated tokens.json back to the file
    await fs.promises.writeFile(tokensJsonFilePath, JSON.stringify(mergedTokensJson, null, 2));

    // Create an array of the symbols in mergedTokensJson
    const mergedTokensSymbols = mergedTokensJson.map(token => token.symbol.toUpperCase());

    // Find the symbols in the whitelist that are not in mergedTokensJson
    const missingSymbols = whitelist.filter((symbol: string) => !mergedTokensSymbols.includes(symbol));

    if (missingSymbols.length > 0) {
        console.log('The following symbols are missing from tokens.json:');
        console.table(missingSymbols.map((symbol: string) => ({ Symbol: symbol })));
        console.log('Please manually add the missing tokens to tokens.json and set manual=true.');
    }

    console.log('tokens.json has been successfully updated!');
}

createTokensJson().catch(console.error);