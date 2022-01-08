/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import {
  Keypair,
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL,
  SystemProgram,
  TransactionInstruction,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import fs from 'mz/fs';
import path from 'path';
import * as borsh from 'borsh';

import { getPayer, getRpcUrl, createKeypairFromFile } from './utils';

import BN from 'bn.js';

/**
 * Connection to the network
 */
let connection: Connection;

/**
 * Keypair associated to the fees' payer
 */
let payer: Keypair;

/**
 * program id
 */
let programId: PublicKey;

/**
 * The public key of the answer account 
 */
let answerPubkey: PublicKey;

/**
 * Path to program files
 */
const PROGRAM_PATH = path.resolve(__dirname, '../target/deploy');

/**
 * Path to program shared object file which should be deployed on chain.
 * This file is created when running either:
 *   - `npm run build:program-c`
 *   - `npm run build:program-rust`
 */
const PROGRAM_SO_PATH = path.join(PROGRAM_PATH, 'banksea_oracle_example.so');

/**
 * Path to the keypair of the deployed program.
 * This file is created when running `solana program deploy ../target/deploy/banksea_oracle_example.so`
 */
const PROGRAM_KEYPAIR_PATH = path.join(PROGRAM_PATH, 'banksea_oracle_example-keypair.json');

/**
 * The oralce program id on devnet
 */
const ORACLE_PROGRAM_ID = new PublicKey("Bft3LCMttxnbKqfXq88xtezVyvDFK3kvD9N1ZXf2TNep");

/**
 * Chain ID defined by oracle
 */
enum ChainId {
  Solana = 0,
  Ethererum,
}
/**
 * @name: encodeChainId
 * @description: encode chain id to Uint8Array
 * @param id: chain id (0: Solana; 1: Ethererum) 
 * @returns uint8 array
 */
function encodeChainId(id: number): Uint8Array {
  const encoder =
    typeof TextEncoder === "undefined"
      ? new (require("util").TextEncoder)("utf-8") // Node.
      : new TextEncoder(); // Browser.
  return encoder.encode(id.toString());
}

/**
 * @name: chainName
 * @description: get chain name by id
 * @param id: chain id (0: Solana; 1: Ethererum) 
 * @returns chain name
 */
function chainName(id: number): string {
  let name: string;
  switch (id) {
    case 0: { name = "Solana"; break; }
    case 1: { name = "Ethererum"; break; }
    default: { name = "DEFAULT"; break; }
  }
  return name;
}

/**
 * @name: getReportIdFromETH
 * @description: use to get reportId
 * @param contractAddr: contract address on Ethereum 
 * @param tokenAddr: token id in a contract like `ERC721` on Ethereum 
 * @returns oracle report account publickey
 */
async function getReportIdFromETH(contractAddr: string, tokenId: string): Promise<PublicKey> {
  const sourceChainId = 1;

  const _programId = new PublicKey(new BN(contractAddr, 16));
  const _tokenId = new PublicKey(new BN(tokenId, 10));
  const [reportId,] = await PublicKey.findProgramAddress(
    [encodeChainId(sourceChainId), _programId.toBuffer(), _tokenId.toBuffer()],
    ORACLE_PROGRAM_ID,
  );
  return reportId;
}

/**
 * @name: getReportIdFromSOL
 * @description: use to get reportId
 * @param tokenMint: nft token mint on Solana
 * @returns oracle report account publickey
 */
async function getReportIdFromSOL(tokenMint: string): Promise<PublicKey> {
  const sourceChainId = 0;
  const _programId = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
  const _tokenId = new PublicKey(tokenMint);
  const [reportId,] = await PublicKey.findProgramAddress(
    [encodeChainId(sourceChainId), _programId.toBuffer(), _tokenId.toBuffer()],
    ORACLE_PROGRAM_ID,
  );
  return reportId;
}

/**
 * The state of a answer account managed by the program
 */
class AnswerAccount {
  sourceChain: number;
  price: number;
  time: number;
  decimal: number;
  programAddr: PublicKey;
  tokenAddr: PublicKey;
  localAddr: PublicKey;
  name: string;
  priceType: string;

  constructor(fields: { sourceChain: number, price: number, time: number, decimal: number, programAddr: Uint8Array, tokenAddr: Uint8Array, localAddr: Uint8Array, name: string, priceType: string }) {
    if (fields) {
      this.sourceChain = fields.sourceChain;
      this.price = fields.price;
      this.time = fields.time;
      this.decimal = fields.decimal;
      this.programAddr = new PublicKey(fields.programAddr);
      this.tokenAddr = new PublicKey(fields.tokenAddr);
      this.localAddr = new PublicKey(fields.localAddr);
      this.name = fields.name;
      this.priceType = fields.priceType;
    }
  }
}

/**
 * Borsh schema definition for answer accounts
 */



const AnswerSchema = new Map([
  [AnswerAccount, { kind: 'struct', fields: [['sourceChain', 'u32'], ['price', 'u64'], ['time', 'u64'], ['decimal', 'u64'], ['programAddr', [32]], ['tokenAddr', [32]], ['localAddr', [32]], ['name', 'string'], ['priceType', 'string']] }],
]);

/**
 * The expected size of each answer account.
 */
const ANSWER_SIZE = 3 * 8 + 2 * 32 + 100 * 2;/*borsh.serialize(AnswerSchema, new AnswerAccount()).length;*/

/**
 * Establish a connection to the cluster
 */
export async function establishConnection(): Promise<void> {
  const rpcUrl = await getRpcUrl();
  connection = new Connection(rpcUrl, 'confirmed');
  const version = await connection.getVersion();
  console.log('Connection to cluster established:', rpcUrl, version);
}

/**
 * Establish an account to pay for everything
 */
export async function establishPayer(): Promise<void> {
  let fees = 0;
  if (!payer) {
    const { feeCalculator } = await connection.getRecentBlockhash();

    // Calculate the cost to fund the answer account
    fees += await connection.getMinimumBalanceForRentExemption(ANSWER_SIZE);

    // Calculate the cost of sending transactions
    fees += feeCalculator.lamportsPerSignature * 100; // wag

    payer = await getPayer();
  }

  let lamports = await connection.getBalance(payer.publicKey);
  if (lamports < fees) {
    // If current balance is not enough to pay for fees, request an airdrop
    const sig = await connection.requestAirdrop(
      payer.publicKey,
      fees - lamports,
    );
    await connection.confirmTransaction(sig);
    lamports = await connection.getBalance(payer.publicKey);
  }

}

/**
 * Check if the program has been deployed
 */
export async function checkProgram(): Promise<void> {
  // Read program id from keypair file
  try {
    const programKeypair = await createKeypairFromFile(PROGRAM_KEYPAIR_PATH);
    programId = programKeypair.publicKey;
  } catch (err) {
    const errMsg = (err as Error).message;
    throw new Error(
      `Failed to read program keypair at '${PROGRAM_KEYPAIR_PATH}' due to error: ${errMsg}. Program may need to be deployed with ${PROGRAM_SO_PATH}`,
    );
  }

  // Check if the program has been deployed
  const programInfo = await connection.getAccountInfo(programId);
  if (programInfo === null) {
    if (fs.existsSync(PROGRAM_SO_PATH)) {
      throw new Error(
        `Program needs to be deployed with ${PROGRAM_SO_PATH}`,
      );
    } else {
      throw new Error('Program needs to be built and deployed');
    }
  } else if (!programInfo.executable) {
    throw new Error(`Program is not executable`);
  }

  // Derive the address (public key) of a answer account from the program so that it's easy to find later.
  const ORALE_SEED = 'Banksea-Oracle-Example';
  answerPubkey = await PublicKey.createWithSeed(
    payer.publicKey,
    ORALE_SEED,
    programId,
  );

  // Check if the answer account has already been created
  const answerAccount = await connection.getAccountInfo(answerPubkey);
  if (answerAccount === null) {
    const lamports = await connection.getMinimumBalanceForRentExemption(
      ANSWER_SIZE,
    );

    const transaction = new Transaction().add(
      SystemProgram.createAccountWithSeed({
        fromPubkey: payer.publicKey,
        basePubkey: payer.publicKey,
        seed: ORALE_SEED,
        newAccountPubkey: answerPubkey,
        lamports,
        space: ANSWER_SIZE,
        programId,
      }),
    );
    await sendAndConfirmTransaction(connection, transaction, [payer]);
  }
}




export async function getPriceOnEthereum(): Promise<void> {
  const reportId = await getReportIdFromETH("b47e3cd837ddf8e4c57f05d70ab865de6e193bbb", "1234"); // It is `CryptoPunk #1234` 

  let report = {
    pubkey: reportId,
    isSigner: false,
    isWritable: false,
  };

  let answer = {
    pubkey: answerPubkey,
    isSigner: false,
    isWritable: true
  };

  const instruction = new TransactionInstruction({
    keys: [report, answer],
    programId,
    data: Buffer.alloc(0),
  });

  await sendAndConfirmTransaction(
    connection,
    new Transaction().add(instruction),
    [payer],
  );


  // print the detail of answer account 
  const accountInfo = await connection.getAccountInfo(answerPubkey);
  if (accountInfo === null) {
    throw 'Error: cannot find the account';
  }

  const answerInfo = borsh.deserializeUnchecked(
    AnswerSchema,
    AnswerAccount,
    Buffer.from(accountInfo.data),
  );

  console.log(
    'Answer Information:',
    `\n\t${answerInfo.name}`,
    `\n\tsource chain = ${chainName(answerInfo.sourceChain)}`,
    `\n\tprogram addr = ${answerInfo.programAddr}`,
    `\n\ttoken addr = ${answerInfo.tokenAddr}`,
    `\n\tlocal addr = ${answerInfo.localAddr}`,
    '\n\tprice is', answerInfo.price / (10 ** answerInfo.decimal), answerInfo.priceType,
    '\n\tupdated on', `'${new Date(answerInfo.time * 1000).toString()}'`,
  );
}

export async function getPriceOnSolana(): Promise<void> {
  const reportId = await getReportIdFromSOL("HeVXJCURxNSjkXESJvnofvmxZ3bAziepJWLk5EfqEt3y"); // It is `Degen Ape #6117` 

  let report = {
    pubkey: reportId,
    isSigner: false,
    isWritable: false,
  };

  let answer = {
    pubkey: answerPubkey,
    isSigner: false,
    isWritable: true
  };

  const instruction = new TransactionInstruction({
    keys: [report, answer],
    programId,
    data: Buffer.alloc(0),
  });

  await sendAndConfirmTransaction(
    connection,
    new Transaction().add(instruction),
    [payer],
  );


  // print the detail of answer account 
  const accountInfo = await connection.getAccountInfo(answerPubkey);
  if (accountInfo === null) {
    throw 'Error: cannot find the account';
  }

  const answerInfo = borsh.deserializeUnchecked(
    AnswerSchema,
    AnswerAccount,
    Buffer.from(accountInfo.data),
  );

  console.log(
    'Answer Information:',
    `\n\t${answerInfo.name}`,
    `\n\tsource chain = ${chainName(answerInfo.sourceChain)}`,
    `\n\tprogram addr = ${answerInfo.programAddr}`,
    `\n\ttoken addr = ${answerInfo.tokenAddr}`,
    `\n\tlocal addr = ${answerInfo.localAddr}`,
    '\n\tprice is', answerInfo.price / (10 ** answerInfo.decimal), answerInfo.priceType,
    '\n\tupdated on', `'${new Date(answerInfo.time * 1000).toString()}'`,
  );
}