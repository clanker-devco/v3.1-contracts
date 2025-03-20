// Use Node.js ESM format for imports
import { deployToken } from './DeployToken.js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function main() {
  // Parse command-line arguments
  const args = process.argv.slice(2);
  
  // Default values
  const defaultConfig = {
    name: 'MyToken',
    symbol: 'MTK',
    imageUrl: 'https://example.com/token.png',
    description: 'This is a sample token',
    lockupPercentage: 20,
    creatorReward: 40,
    chainId: 8453, // Base mainnet
    devBuyAmount: '0.01',
    vestingUnlockDate: 1774054678, // at least 30 days from now
  };
  
  // Override defaults with provided args
  const config: any = { ...defaultConfig };
  
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace('--', '');
    const value = args[i + 1];
    
    if (key === 'lockupPercentage' || key === 'creatorReward' || key === 'chainId' || key === 'vestingUnlockDate') {
      config[key] = parseInt(value);
    } else if (key === 'devBuyAmount') {
      config[key] = value;
    } else {
      config[key] = value;
    }
  }
  
  // Get deployer address from env
  const deployerAddress = process.env.DEPLOYER_ADDRESS as `0x${string}`;
  if (!deployerAddress) {
    throw new Error('DEPLOYER_ADDRESS environment variable is not set');
  }
  
  // Prepare form data
  const formData = {
    name: config.name,
    symbol: config.symbol,
    imageUrl: config.imageUrl,
    description: config.description,
    lockupPercentage: config.lockupPercentage,
    creatorReward: config.creatorReward,
    devBuyAmount: config.devBuyAmount,
    vestingUnlockDate: BigInt(config.vestingUnlockDate),
    creatorRewardsRecipient: config.creatorRewardsRecipient || deployerAddress,
    creatorRewardsAdmin: config.creatorRewardsAdmin || deployerAddress,
    interfaceAdmin: config.interfaceAdmin || deployerAddress,
    interfaceRewardRecipient: config.interfaceRewardRecipient || deployerAddress,
  };
  
  console.log('Deploying token with configuration:', formData);
  
  try {
    const txHash = await deployToken({
      deployerAddress,
      formData,
      chainId: config.chainId,
      desiredPrice: config.desiredPrice || 10,
    });
    
    console.log(`✅ Token deployment transaction sent successfully!`);
    console.log(`Transaction hash: ${txHash}`);
  } catch (error: any) {
    console.error(`❌ Error deploying token: ${error.message}`);
    process.exit(1);
  }
}

main().catch(console.error); 