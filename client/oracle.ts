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
 * The keypair of the answer account 
 */

const answerKeypair = Keypair.generate();

/**
 * The public key of the answer account 
 */
const answerPubkey = answerKeypair.publicKey;

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
 * The state of a answer account managed by the program
 */
class AnswerAccount {
  code: string;
  unit: string;
  floorPrice: number;
  AIFloorPrice: number;
  avgPrice: number;
  decimals: number;
  aggregateTime: number;

  constructor(fields: { code: string, unit: string, decimals: number, aggregateTime: number, floorPrice: number, AIFloorPrice: number, avgPrice: number}) {
    if (fields) {
      this.code = fields.code;
      this.floorPrice = fields.floorPrice;
      this.AIFloorPrice = fields.AIFloorPrice;
      this.avgPrice = fields.avgPrice;
      this.unit = fields.unit;
      this.decimals = fields.decimals;
      this.aggregateTime = fields.aggregateTime;
    }
  }

  print() {
    console.log(
      'Answer Information:',
      `\n\t${this.code}`,
      '\n\tfloor price is', this.floorPrice / (10 ** this.decimals), this.unit,
      '\n\tAI floor price is', this.AIFloorPrice / (10 ** this.decimals), this.unit,
      '\n\tavg price is', this.avgPrice / (10 ** this.decimals), this.unit,
      '\n\tupdated on', `'${new Date(this.aggregateTime * 1000).toUTCString()}'`,
    );
  }
}

/**
 * Borsh schema definition for answer account
 */

const AnswerSchema = new Map([
  [AnswerAccount, { kind: 'struct', fields: [['code', 'string'], ['unit', 'string'], ['decimals', 'u64'], ['aggregateTime', 'u64'], ['floorPrice', 'u64'], ['AIFloorPrice', 'u64'],  ['avgPrice', 'u64'], ] }],
]);

/**
 * The expected size of each answer account
 */
const ANSWER_SIZE = 4 + 128  + 4 + 128 + 8 + 8 + 8 + 8 + 8;/*borsh.serialize(AnswerSchema, new AnswerAccount()).length;*/

/**
 * Establish a connection to the cluster
 */
export async function establishConnection(): Promise<void> {
  const rpcUrl = await getRpcUrl();
  connection = new Connection(rpcUrl, 'confirmed');
  const version = await connection.getVersion();
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



  const lamports = await connection.getMinimumBalanceForRentExemption(
    ANSWER_SIZE,
  );
  
  const transaction = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: answerPubkey,
      lamports,
      space: ANSWER_SIZE,
      programId,
    }),
  );
  await sendAndConfirmTransaction(connection, transaction, [payer, answerKeypair]);
}

// A example for getting oracle data
export async function getOracleInfo(): Promise<void> {
  const feedAccountId = new PublicKey("DGaMbFh9BPZbNVWLygK4m3VhxBaNZkCumbnhpijFroaD") // It is `degods` 

  let feedAccount = {
    pubkey: feedAccountId,
    isSigner: false,
    isWritable: false,
  };

  let answer = {
    pubkey: answerPubkey,
    isSigner: false,
    isWritable: true
  };

  const instruction = new TransactionInstruction({
    keys: [feedAccount, answer],
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

  answerInfo.print();
}