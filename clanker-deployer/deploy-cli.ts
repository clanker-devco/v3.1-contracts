// Use Node.js ESM format for imports
import { deployToken } from './DeployToken.js';
import * as dotenv from 'dotenv';
import { IClankerSocialContext, IDeployFormData } from './helpers/types.js';

// Load environment variables
dotenv.config();

async function main() {
  // Default values
  const config: IDeployFormData = {
    name: 'MyToken',
    symbol: 'MTK',
    imageUrl: 'https://example.com/token.png',
    creatorRewardsRecipient: '', // address of the creator rewards recipient
    creatorRewardsAdmin: '', // address of the creator rewards admin
    interfaceAdmin: '', // address of the interface admin
    interfaceRewardRecipient: '', // address of the interface reward recipient
    // optional deployment info
    lockupPercentage: 20, // 0-30
    creatorReward: 40, // 0-80
    devBuyAmount: '0', // denominated in ETH  (0.01 = 0.01 ETH)
    vestingUnlockDate: 1774054678n, // at least 30 days from now, unix timestamp of vesting unlock date
    pairedToken: 'WETH', // WETH, DEGEN, ANON, HIGHER, CLANKER, BTC, NATIVE
    // optional project metadata
    description: 'This is a sample token',
    telegramLink: 'https://t.me/testuser',
    websiteLink: 'https://example.com',
    xLink: 'https://x.com/testuser',
    farcasterLink: 'https://farcaster.com/testuser',
    // deployment config (optional, fee tier of paired token pool)
    pairedTokenPoolFee: 10000, // 10000 = 1%
    pairedTokenDecimals: 18, // decimals of the paired token
  };

  // optional social context for the deployment
  const deploymentContext: IClankerSocialContext = {
    interface: process.env.INTERFACE_NAME || '',
    platform: 'farcaster', // farcaster, twitter, telegram, website, x
    messageId: '1234567890', // cast hash, tweet id, etc.
    id: 'testuser', // FID, X username, etc.
  };

  console.log('Deploying token with configuration:', config);

  try {
    const txHash = await deployToken({
      deployerAddress: process.env.DEPLOYER_ADDRESS as `0x${string}`,
      formData: config,
      context: deploymentContext,
      chainId: 8453, // base
    });

    console.log(`✅ Token deployment transaction sent successfully!`);
    console.log(`Transaction hash: ${txHash}`);
  } catch (error: any) {
    console.error(`❌ Error deploying token: ${error.message}`);
    process.exit(1);
  }
}

main().catch(console.error);
