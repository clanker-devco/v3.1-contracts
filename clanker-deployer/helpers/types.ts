export type TokenPair =
  | 'WETH'
  | 'DEGEN'
  | 'ANON'
  | 'HIGHER'
  | 'CLANKER'
  | 'BTC'
  | 'NATIVE'
  | null;

export interface IDeployFormData {
  name: string;
  symbol: string;
  image?: File | null;
  imageUrl?: string;
  description?: string;
  // Amount of paired token to use for the initial buy (creates initial liquidity)
  devBuyAmount?: string | number;
  // Percentage of token supply to lock in vesting contract (0-30)
  lockupPercentage?: number;
  // Unix timestamp when locked tokens can be released
  vestingUnlockDate?: bigint | null;
  telegramLink?: string;
  websiteLink?: string;
  xLink?: string;
  farcasterLink?: string;
  // Address of the token to pair with (defaults to WETH if not specified)
  pairedToken?: TokenPair;
  creatorRewardsRecipient?: string;
  creatorRewardsAdmin?: string;
  creatorReward?: number;
  interfaceAdmin?: string;
  interfaceRewardRecipient?: string;
  pairedTokenPoolFee?: number;
  pairedTokenDecimals?: number;
}

export interface IClankerMetadata {
  description?: string;
  socialMediaUrls?: Array<{ platform: string; url: string }>;
  auditUrls?: string[];
}

export interface IClankerSocialContext {
  interface: string;
  platform?: string;
  messageId?: string;
  id?: string;
}

export interface IUserInfo {
  farcaster?: { fid?: number };
  twitter?: { username?: string };
}
