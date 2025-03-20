import {
  encodeFunctionData,
  encodeAbiParameters,
  encodePacked,
  keccak256,
  parseUnits,
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
  devBuyAmount?: string | number;
  lockupPercentage?: number;
  vestingUnlockDate?: bigint | null;
  enableDevBuy?: boolean;
  enableLockup?: boolean;
  feeRecipient?: string | null;
  telegramLink?: string;
  websiteLink?: string;
  xLink?: string;
  marketCap?: string;
  farcasterLink?: string;
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
      console.warn('Target timestamp is in the past, using minimum duration');
      vestingDuration = BigInt(31 * 24 * 60 * 60); // 31 days in seconds
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
  const logBase = 1.0001;
  const tickSpacing = 200;
  const rawTick = Math.log(desiredPrice) / Math.log(logBase);
  const initialTick = Math.floor(rawTick / tickSpacing) * tickSpacing;

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
      pairedTokenPoolFee: 10000,
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
  desiredPrice = 10, // Default desired price (pairs with WETH)
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

