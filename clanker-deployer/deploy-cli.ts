// Use Node.js ESM format for imports
import { deployToken } from './DeployToken.js';
import * as dotenv from 'dotenv';
import { IDeployFormData, TokenPair } from './types.js';
import { getDesiredPriceAndPairAddress } from './utils.js';

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
    devBuyAmount: '0', // denominated in ETH  (0.01 = 0.01 ETH)
    vestingUnlockDate: BigInt(1774054678), // at least 30 days from now, unix timestamp
    pair: 'WETH',
    creatorRewardsRecipient: '',
    creatorRewardsAdmin: '',
    interfaceAdmin: '',
    interfaceRewardRecipient: '',
  };
  
  // Override defaults with provided args
  const config: Record<string, any> = { ...defaultConfig };
  
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace('--', '');
    const value = args[i + 1];
    
    if (key === 'lockupPercentage' || key === 'creatorReward' || key === 'chainId') {
      config[key] = parseInt(value);
    } else if (key === 'vestingUnlockDate') {
      config[key] = BigInt(parseInt(value));
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
  const formData: IDeployFormData = {
    name: config.name,
    symbol: config.symbol,
    imageUrl: config.imageUrl,
    description: config.description,
    lockupPercentage: config.lockupPercentage,
    creatorReward: config.creatorReward,
    devBuyAmount: config.devBuyAmount,
    vestingUnlockDate: config.vestingUnlockDate,
    creatorRewardsRecipient: config.creatorRewardsRecipient || deployerAddress,
    creatorRewardsAdmin: config.creatorRewardsAdmin || deployerAddress,
    interfaceAdmin: config.interfaceAdmin || deployerAddress,
    interfaceRewardRecipient: config.interfaceRewardRecipient || deployerAddress,
  };
  
  console.log('Deploying token with configuration:', formData);

  const { desiredPrice, pairAddress } = getDesiredPriceAndPairAddress(config.pair as TokenPair);
  
  // Set the paired token address based on the selected pair
  formData.pairedToken = pairAddress;
  
  try {
    const txHash = await deployToken({
      deployerAddress,
      formData,
      chainId: config.chainId,
      desiredPrice,
    });
    
    console.log(`✅ Token deployment transaction sent successfully!`);
    console.log(`Transaction hash: ${txHash}`);
  } catch (error: any) {
    console.error(`❌ Error deploying token: ${error.message}`);
    process.exit(1);
  }
}

main().catch(console.error); 

