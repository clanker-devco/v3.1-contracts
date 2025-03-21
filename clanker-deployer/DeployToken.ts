import { encodeAbiParameters, encodePacked, keccak256 } from 'viem';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { IDeployFormData, IClankerSocialContext } from './types.js';
import { CLANKER_FACTORY_V3_1 } from './constants.js';
import { buildDeploymentTransaction } from './build-transaction.js';

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
  initialSupplyChainId: bigint
): Promise<{ salt: `0x${string}`; token: `0x${string}` }> {
  const startingPoint = BigInt(
    '0x' +
      Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
  );
  let i = startingPoint;
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

  return { salt, token };
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
    transport: http(process.env.RPC_URL || 'https://mainnet.base.org'),
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
 * Deploys a token using the Clanker contracts
 */
export async function deployToken({
  deployerAddress,
  formData,
  chainId,
  context,
  gasLimit = BigInt(10000000),
}: {
  deployerAddress: `0x${string}`;
  formData: IDeployFormData;
  chainId: number;
  context?: IClankerSocialContext;
  gasLimit?: bigint;
}): Promise<string> {
  try {
    // Build the transaction
    const { transaction, value } = await buildDeploymentTransaction({
      deployerAddress,
      formData,
      chainId,
      context,
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
