// Use Node.js ESM format for imports
import * as dotenv from 'dotenv';
import { Clanker } from 'clanker-sdk';
import type { ClankerConfig } from 'clanker-sdk';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { createPublicClient, http, createWalletClient, PublicClient } from 'viem';

// Load environment variables
dotenv.config();

async function main() {
  // Default values


  try {
    const wallet = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
    const publicClient = createPublicClient({
      chain: base,
      transport: http(),
      batch: {
        multicall: true
      }
    });
    
    const walletClient = createWalletClient({
      account: wallet,
      chain: base,
      transport: http()
    });
    const config: ClankerConfig = {
      wallet: walletClient,
      publicClient: publicClient as PublicClient
    };
    
    const clanker = new Clanker(config);
    const txHash = await clanker.deployToken({
      name: 'MyToken',
      symbol: 'MTK',
    });
    console.log(`✅ Token deployment transaction sent successfully!`);
    console.log(`Transaction hash: ${txHash}`);
  } catch (error: any) {
    console.error(`❌ Error deploying token: ${error.message}`);
    process.exit(1);
  }
}

main().catch(console.error);
