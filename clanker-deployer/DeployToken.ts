import {
  encodeFunctionData,
  encodeAbiParameters,
  encodePacked,
  keccak256,
  parseUnits,
  createPublicClient,
} from 'viem';
import { Clanker_v3_1_abi } from './Clanker.js';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
// Real value for the Wrapped ETH (WETH) address.
const WETH_ADDRESS =
  '0x4200000000000000000000000000000000000006' as `0x${string}`;
const CLANKER_FACTORY_V3_1 =
  '0x2A787b2362021cC3eEa3C24C4748a6cD5B687382' as `0x${string}`;

// Type definitions
interface IDeployFormData {
  name: string;
  symbol: string;
  image?: File | null;
  imageUrl?: string;
  description?: string;
  // Amount of paired token to use for the initial buy (creates initial liquidity)
  devBuyAmount?: string | number;
  // Percentage of token supply to lock in vesting contract (0-100)
  lockupPercentage?: number;
  // Unix timestamp when locked tokens can be released
  vestingUnlockDate?: bigint | null;
  // Whether to perform an initial buy with paired token (creates liquidity)
  // This controls whether devBuyAmount is used
  enableDevBuy?: boolean;
  // Whether to enable token lockup/vesting
  // This controls whether lockupPercentage and vestingUnlockDate are used
  enableLockup?: boolean;
  // Address to receive protocol fees (if applicable)
  feeRecipient?: string | null;
  telegramLink?: string;
  websiteLink?: string;
  xLink?: string;
  marketCap?: string;
  farcasterLink?: string;
  // Address of the token to pair with (defaults to WETH if not specified)
  pairedToken?: string;
  creatorRewardsRecipient?: string;
  creatorRewardsAdmin?: string;
  creatorReward?: number;
  interfaceAdmin?: string;
  interfaceRewardRecipient?: string;
}

interface IClankerMetadata {
  description?: string;
  socialMediaUrls?: Array<{ platform: string; url: string }>;
  auditUrls?: string[];
}

interface IClankerSocialContext {
  interface: string;
  platform?: string;
  messageId?: string;
  id?: string;
}

interface IUserInfo {
  farcaster?: { fid?: number };
  twitter?: { username?: string };
}

// Helper functions
function getRelativeUnixTimestamp(unixTimestamp?: number | null): bigint {
  if (!unixTimestamp) return BigInt(0);

  let vestingDuration = BigInt(0);
  if (unixTimestamp && BigInt(unixTimestamp) > BigInt(0)) {
    const currentTimestamp = BigInt(Math.floor(Date.now() / 1000));
    const targetTimestamp = BigInt(unixTimestamp);
    if (targetTimestamp > currentTimestamp) {
      vestingDuration = targetTimestamp - currentTimestamp;
    } else {
      throw new Error('Target timestamp is in the past. Please provide a future date for vesting.');
    }
  }
  return vestingDuration;
}

async function predictToken_v3_1(
  admin: `0x${string}`,
  name: string,
  symbol: string,
  image: string,
  metadata: string,
  context: string,
  supply: bigint,
  salt: `0x${string}`,
  initialSupplyChainId: bigint
): Promise<`0x${string}`> {
  const create2Salt = keccak256(
    encodeAbiParameters(
      [{ type: 'address' }, { type: 'bytes32' }],
      [admin, salt]
    )
  );

  const constructorArgs = encodeAbiParameters(
    [
      { type: 'string' },
      { type: 'string' },
      { type: 'uint256' },
      { type: 'address' },
      { type: 'string' },
      { type: 'string' },
      { type: 'string' },
      { type: 'uint256' },
    ],
    [
      name,
      symbol,
      supply,
      admin,
      image,
      metadata,
      context,
      initialSupplyChainId,
    ]
  );

  // Get contract artifacts
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const artifactPath = path.join(__dirname, 'ClankerToken.json');
  const artifactContent = fs.readFileSync(artifactPath, 'utf8');
  const artifact = JSON.parse(artifactContent);
  const creationCode = artifact.bytecode.object as `0x${string}`;
  const encodedCreationCode = encodePacked(
    ['bytes', 'bytes'],
    [creationCode, constructorArgs]
  );
  const creationCodeHash = keccak256(encodedCreationCode);

  const hash = keccak256(
    encodePacked(
      ['uint8', 'address', 'bytes32', 'bytes32'],
      [0xff, CLANKER_FACTORY_V3_1, create2Salt, creationCodeHash]
    )
  );

  return `0x${hash.slice(-40)}` as `0x${string}`;
}

export async function generateSalt_v3_1(
  admin: `0x${string}`,
  name: string,
  symbol: string,
  image: string,
  metadata: string,
  context: string,
  supply: bigint,
  pairedTokenAddress: `0x${string}`,
  initialSupplyChainId: bigint
): Promise<{ salt: `0x${string}`; token: `0x${string}` }> {
  const startingPoint = BigInt(
    '0x' +
      Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
  );
  let i = startingPoint;
  while (true) {
    const salt = `0x${i.toString(16).padStart(64, '0')}` as `0x${string}`;

    const token = await predictToken_v3_1(
      admin,
      name,
      symbol,
      image,
      metadata,
      context,
      supply,
      salt,
      initialSupplyChainId
    );

    const tokenNum = BigInt(token);
    const pairedTokenNum = BigInt(pairedTokenAddress);

    // This condition ensures the token address is numerically lower than the paired token.
    // This is important for Uniswap V3 pool creation where tokens are sorted by address.
    // You can modify this condition based on your specific address requirements or aesthetics.
    // For example, you might want addresses with certain patterns or characteristics.
    if (tokenNum < pairedTokenNum) {
      return { salt, token };
    }

    i += BigInt(
      Math.floor(crypto.getRandomValues(new Uint8Array(1))[0] % 1000) + 1
    );
  }
}

// Replace the dummy transaction sender with a real implementation
async function sendTransactionAsync({
  to,
  data,
  value,
  gas,
}: {
  to: `0x${string}`;
  data: `0x${string}`;
  value: bigint;
  gas: bigint;
}): Promise<string> {
  const privateKey = process.env.PRIVATE_KEY as `0x${string}`;
  if (!privateKey) {
    throw new Error('PRIVATE_KEY environment variable is not set');
  }
  
  const account = privateKeyToAccount(privateKey);
  const client = createWalletClient({
    account,
    chain: base,
    transport: http(process.env.RPC_URL || 'https://mainnet.base.org')
  });
  
  const hash = await client.sendTransaction({
    to,
    data,
    value,
    gas,
    chain: base,
  });
  
  return hash;
}

/**
 * Builds a token deployment transaction
 */
async function buildDeploymentTransaction({
  deployerAddress,
  formData,
  chainId,
  userInfo,
  desiredPrice = 10, // Default desired price (pairs with WETH)
}: {
  deployerAddress: `0x${string}`;
  formData: IDeployFormData;
  chainId: number;
  userInfo?: IUserInfo;
  desiredPrice?: number;
}): Promise<{
  transaction: {
    to: `0x${string}`;
    data: `0x${string}`;
  };
  value: bigint;
}> {
  if (!deployerAddress) {
    throw new Error('No account address found');
  }

  // Create metadata and social context
  const clankerMetadata: IClankerMetadata = {
    description: formData.description || 'No description provided',
    socialMediaUrls: [
      ...(formData.telegramLink
        ? [{ platform: 'telegram', url: formData.telegramLink }]
        : []),
      ...(formData.websiteLink
        ? [{ platform: 'website', url: formData.websiteLink }]
        : []),
      ...(formData.xLink ? [{ platform: 'x', url: formData.xLink }] : []),
      ...(formData.farcasterLink
        ? [{ platform: 'farcaster', url: formData.farcasterLink }]
        : []),
    ],
    auditUrls: [],
  };

  const clankerSocialContext: IClankerSocialContext = {
    interface: 'YOUR_INTERFACE_HERE',
    platform: userInfo?.farcaster ? 'farcaster' : userInfo?.twitter ? 'X' : '',
    messageId: '',
    id: userInfo?.farcaster?.fid
      ? userInfo.farcaster.fid.toString()
      : userInfo?.twitter?.username || '',
  };

  // Determine paired token
  const pairAddress =
    formData.pairedToken && formData.pairedToken.length > 0
      ? (formData.pairedToken as `0x${string}`)
      : WETH_ADDRESS;

  // Calculate initial tick for price
  // Note: This calculation assumes both tokens have standard 18 decimals.
  // For tokens with non-standard decimals (e.g., USDC with 6 decimals),
  // you'll need to adjust the price calculation to account for the decimal difference:
  // - If paired token has 6 decimals (like USDC): multiply desiredPrice by 10^12
  // - General formula: desiredPrice * (10^(token1Decimals - token0Decimals))
  // Where token0 is the token with the lower address (which could be either your token or paired token)
  const logBase = 1.0001;
  const tickSpacing = 200;
  const rawTick = Math.log(desiredPrice) / Math.log(logBase);
  const initialTick = Math.floor(rawTick / tickSpacing) * tickSpacing;

  // Important: The contracts expect the tick to always be calculated as if the
  // created token has a lower address than the paired token, even when its actual address is higher.
  // Uniswap V3 sorts tokens by address, so this ensures consistent pricing.

  // Generate salt
  const { salt } = await generateSalt_v3_1(
    deployerAddress,
    formData.name,
    formData.symbol,
    formData.imageUrl || '',
    JSON.stringify(clankerMetadata),
    JSON.stringify(clankerSocialContext),
    BigInt(parseUnits('100000000000', 18).toString()),
    pairAddress,
    BigInt(chainId)
  );

  // Format metadata and social context
  const metadata = JSON.stringify(clankerMetadata);
  const socialContext = JSON.stringify(clankerSocialContext);

  // Calculate vesting duration
  let vestingDuration = formData.vestingUnlockDate
    ? getRelativeUnixTimestamp(Number(formData.vestingUnlockDate))
    : BigInt(0);

  // Fail early if vesting duration is too short (optional minimum check)
  const MIN_VESTING_DURATION = BigInt(7 * 24 * 60 * 60); // 7 days in seconds
  if (vestingDuration > 0 && vestingDuration < MIN_VESTING_DURATION) {
    throw new Error(`Vesting duration is too short. Minimum duration is ${MIN_VESTING_DURATION} seconds.`);
  }

  // Helper to validate addresses
  const validateAddress = (
    address: string | undefined,
    defaultAddress: `0x${string}`
  ): `0x${string}` => {
    if (!address || address.trim() === '' || !address.startsWith('0x')) {
      return defaultAddress;
    }
    return address as `0x${string}`;
  };

  // Build the deployment config
  const deploymentConfig = {
    tokenConfig: {
      name: formData.name,
      symbol: formData.symbol,
      salt: salt,
      image: formData.imageUrl || '',
      metadata: metadata,
      context: socialContext,
      originatingChainId: BigInt(chainId),
    },
    poolConfig: {
      pairedToken: pairAddress,
      tickIfToken0IsNewToken: initialTick || 0,
    },
    initialBuyConfig: {
      // Select appropriate fee tier based on paired token
      // 10000 = 1%, 3000 = 0.3%, 500 = 0.05%
      // Some tokens like USDC might not have pools with 1% fee tier on certain chains
      pairedTokenPoolFee: pairAddress === WETH_ADDRESS ? 10000 : 
        // Use 0.3% fee tier for non-WETH pairs like USDC as it's more common
        3000,
      pairedTokenSwapAmountOutMinimum: 0n,
    },
    vaultConfig: {
      vaultDuration: vestingDuration,
      vaultPercentage: formData.lockupPercentage || 0,
    },
    rewardsConfig: {
      creatorReward: BigInt(Number(formData.creatorReward || 40)),
      creatorAdmin: validateAddress(
        formData.creatorRewardsAdmin,
        deployerAddress
      ),
      creatorRewardRecipient: validateAddress(
        formData.creatorRewardsRecipient,
        deployerAddress
      ),
      interfaceAdmin: validateAddress(formData.interfaceAdmin, deployerAddress),
      interfaceRewardRecipient: validateAddress(
        formData.interfaceRewardRecipient,
        deployerAddress
      ),
    },
  } as const;

  // Calculate value to send (dev buy amount)
  const txValue =
    typeof formData.devBuyAmount === 'number' && formData.devBuyAmount > 0
      ? parseUnits(formData.devBuyAmount.toString(), 18)
      : typeof formData.devBuyAmount === 'string' &&
        formData.devBuyAmount !== ''
      ? parseUnits(formData.devBuyAmount, 18)
      : BigInt(0);

  try {
    // Encode the function call
    const deployCalldata = encodeFunctionData({
      abi: Clanker_v3_1_abi,
      functionName: 'deployToken',
      args: [deploymentConfig],
    });

    return {
      transaction: {
        to: CLANKER_FACTORY_V3_1,
        data: deployCalldata,
      },
      value: txValue,
    };
  } catch (error: any) {
    console.error('Error encoding function data:', error);
    console.error('Problematic deployArgs:', deploymentConfig);
    throw new Error(`Failed to encode function data: ${error.message}`);
  }
}

/**
 * Deploys a token using the Clanker contracts
 */
export async function deployToken({
  deployerAddress,
  formData,
  chainId,
  userInfo,
  // Default desired price of 10 means:
  // If your token has the lower address: 1 token = 0.1 WETH 
  // If paired token has the lower address: 1 WETH = 10 tokens
  desiredPrice = 10,
  gasLimit = BigInt(10000000),
}: {
  deployerAddress: `0x${string}`;
  formData: IDeployFormData;
  chainId: number;
  userInfo?: IUserInfo;
  desiredPrice?: number;
  gasLimit?: bigint;
}): Promise<string> {
  try {
    // Build the transaction
    const { transaction, value } = await buildDeploymentTransaction({
      deployerAddress,
      formData,
      chainId,
      userInfo,
      desiredPrice,
    });

    // Send the transaction
    const hash = await sendTransactionAsync({
      to: transaction.to,
      data: transaction.data,
      value,
      gas: gasLimit,
    });

    console.log('Token deployment transaction sent, hash:', hash);
    return hash;
  } catch (error: any) {
    console.error('Error deploying token:', error);
    throw new Error(`Failed to deploy token: ${error.message}`);
  }
}
// Example usage
// deployToken({
//   deployerAddress: process.env.DEPLOYER_ADDRESS as `0x${string}`,
//   formData: {
//     name: 'MyToken',
//     symbol: 'MTK',
//     imageUrl: 'https://example.com/token.png',
//     description: 'This is a sample token',
//     lockupPercentage: 20,
//     creatorReward: 40,
//     vestingUnlockDate: 1774054678n,
//     creatorRewardsRecipient: process.env.CREATOR_REWARDS_RECIPIENT as `0x${string}`,
//     creatorRewardsAdmin: process.env.CREATOR_REWARDS_ADMIN as `0x${string}`,
//     interfaceAdmin: process.env.INTERFACE_ADMIN as `0x${string}`,
//     interfaceRewardRecipient: process.env.INTERFACE_REWARD_RECIPIENT as `0x${string}`,
//   },
//   chainId: 8453,
// }).catch(console.error);

/**
 * Calculates the market cap for a token in a Uniswap V3 pool, including for non-WETH pairs
 * @param poolAddress The address of the Uniswap V3 pool
 * @param tokenAddress The address of the token to calculate market cap for
 * @returns Object containing circulatingSupply, marketCap, and price
 */
export async function calculateMarketCap(poolAddress: `0x${string}`, tokenAddress: `0x${string}`) {
  try {
    const publicClient = baseClient;

    // Get token0 and token1 addresses
    const [token0Address, token1Address] = await Promise.all([
      publicClient.readContract({
        address: poolAddress,
        abi: UniswapV3Pool_abi,
        functionName: 'token0',
      }),
      publicClient.readContract({
        address: poolAddress,
        abi: UniswapV3Pool_abi,
        functionName: 'token1',
      }),
    ]);

    // Determine if our token is token0 or token1
    const isToken0 = tokenAddress.toLowerCase() === token0Address.toLowerCase();
    if (!isToken0 && tokenAddress.toLowerCase() !== token1Address.toLowerCase()) {
      throw new Error('The provided token address is not part of the pool.');
    }

    // Get token decimals and total supply
    const [decimals, totalSupply, slot0] = await Promise.all([
      publicClient.readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: 'decimals',
      }),
      publicClient.readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: 'totalSupply',
      }),
      publicClient.readContract({
        address: poolAddress,
        abi: UniswapV3Pool_abi,
        functionName: 'slot0',
      }),
    ]);

    const [sqrtPriceX96] = slot0;
    const Q96 = BigInt('79228162514264337593543950336'); // 2^96 pre-calculated

    // Calculate token price in terms of WETH
    let tokenPriceInWETH;
    if (isToken0) {
      tokenPriceInWETH = (Number(sqrtPriceX96) / Number(Q96)) ** 2;
    } else {
      tokenPriceInWETH = (Number(Q96) / Number(sqrtPriceX96)) ** 2;
    }

    // Get WETH price in USD
    const wethPriceInUSD = await getWETHPriceInUSD(publicClient);

    // Calculate final values
    const tokenPriceInUSD = tokenPriceInWETH * wethPriceInUSD;
    const formattedTotalSupply = Number(totalSupply) / 10 ** Number(decimals);
    const marketCap = tokenPriceInUSD * formattedTotalSupply;

    return {
      circulatingSupply: formattedTotalSupply,
      marketCap,
      price: tokenPriceInUSD,
    };
  } catch (error) {
    console.error('Error calculating market cap:', error);
    throw error;
  }
}

// Import necessary ABIs and client for market cap calculation
// Using standard erc20 ABI instead of importing from specific path
const erc20Abi = [
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ internalType: 'uint8', name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalSupply',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// Uniswap V3 Pool ABI (minimal for our needs)
const UniswapV3Pool_abi = [
  {
    inputs: [],
    name: 'token0',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'token1',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'slot0',
    outputs: [
      { internalType: 'uint160', name: 'sqrtPriceX96', type: 'uint160' },
      { internalType: 'int24', name: 'tick', type: 'int24' },
      { internalType: 'uint16', name: 'observationIndex', type: 'uint16' },
      { internalType: 'uint16', name: 'observationCardinality', type: 'uint16' },
      { internalType: 'uint16', name: 'observationCardinalityNext', type: 'uint16' },
      { internalType: 'uint8', name: 'feeProtocol', type: 'uint8' },
      { internalType: 'bool', name: 'unlocked', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// Create a public client for market cap calculation
const baseClient = createPublicClient({
  chain: base,
  transport: http(process.env.RPC_URL || 'https://mainnet.base.org'),
});

// Function to get WETH price in USD (placeholder - implement according to your needs)
async function getWETHPriceInUSD(client: any): Promise<number> {
  // This is a placeholder. You would need to implement this function
  // to get the current WETH price in USD, possibly using an oracle or price feed
  try {
    // Example implementation might query a price oracle or use a fixed value
    return 2000; // Placeholder value
  } catch (error) {
    console.error('Error fetching WETH price:', error);
    return 2000; // Fallback value
  }
}

