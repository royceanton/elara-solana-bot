// tokenData.ts
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

export interface Token {
    address: string;
    decimals: number;
    name: string;
    symbol: string;
    manual?: boolean;
}

export async function fetchTokenData(sortType: string): Promise<Token[]> {
    const options = {
        method: 'GET',
        headers: {'x-chain': 'solana', 'X-API-KEY': process.env.BIRDEYE_API_KEY || ''}
    };
    const response = await fetch(`https://public-api.birdeye.so/public/tokenlist?sort_by=${sortType}&sort_type=desc`, options);
    const tokenData = await response.json();
    return tokenData.data.tokens;
}