import { encodeFunctionData, parseUnits } from 'viem';
import { Clanker_v3_1_abi } from './Clanker.js';
import {
  IDeployFormData,
  IClankerMetadata,
  IClankerSocialContext,
  TokenPair,
} from './types.js';
import { CLANKER_FACTORY_V3_1 } from '../constants.js';
import {
  getDesiredPriceAndPairAddress,
  getRelativeUnixTimestamp,
} from '../utils.js';
import { generateSalt_v3_1 } from '../DeployToken.js';

/**
 * Builds a token deployment transaction
 */
export async function buildDeploymentTransaction({
  deployerAddress,
  formData,
  chainId,
  context,
}: {
  deployerAddress: `0x${string}`;
  formData: IDeployFormData;
  chainId: number;
  context?: IClankerSocialContext;
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
    interface: context?.interface || '',
    platform: context?.platform || '',
    messageId: context?.messageId || '',
    id: context?.id || '',
  };

  const { desiredPrice, pairAddress } = getDesiredPriceAndPairAddress(
    formData.pairedToken as TokenPair
  );

  // Calculate initial tick for price
  let initialTick = 0;
  if (formData.pairedTokenDecimals === 18) {
    const logBase = 1.0001;
    const tickSpacing = 200;
    const rawTick = Math.log(desiredPrice) / Math.log(logBase);
    initialTick = Math.floor(rawTick / tickSpacing) * tickSpacing;
  } else {
    // TODO: adjust for non-18 decimals
    console.error('Non-18 decimals not supported yet');
    throw new Error('Non-18 decimals not supported yet');
    // const decimals = formData.pairedTokenDecimals || 18;
    // const logBase = 1.0001;
    // const tickSpacing = 200;
    // // Adjust price based on decimal difference from 18
    // const decimalAdjustment = Math.pow(10, 18 - decimals);
    // const adjustedPrice = desiredPrice * decimalAdjustment;
    // const rawTick = Math.log(adjustedPrice) / Math.log(logBase);
    // initialTick = Math.floor(rawTick / tickSpacing) * tickSpacing;
  }

  // Generate salt
  const { salt } = await generateSalt_v3_1(
    deployerAddress,
    formData.name,
    formData.symbol,
    formData.imageUrl || '',
    JSON.stringify(clankerMetadata),
    JSON.stringify(clankerSocialContext),
    BigInt(parseUnits('100000000000', 18).toString()),
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
    throw new Error(
      `Vesting duration is too short. Minimum duration is ${MIN_VESTING_DURATION} seconds.`
    );
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
      tickIfToken0IsNewToken: initialTick,
    },
    initialBuyConfig: {
      pairedTokenPoolFee: formData.pairedTokenPoolFee || 10000, // 10000 = 1%
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
