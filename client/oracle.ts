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

import {getPayer, getRpcUrl, createKeypairFromFile} from './utils';

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
  const PROGRAM_SO_PATH = path.join(PROGRAM_PATH, 'solana_oracle_example.so');
  
  /**
   * Path to the keypair of the deployed program.
   * This file is created when running `solana program deploy ../target/deploy/solana_oracle_example.so`
   */
  const PROGRAM_KEYPAIR_PATH = path.join(PROGRAM_PATH, 'solana_oracle_example-keypair.json');
  
  /**
   * The state of a answer account managed by the program
   */
  class AnswerAccount {
    addr: PublicKey;
    price: number;
    time: number;
    decimal: number;
    name: string;
    priceType: string;

    constructor(fields: {addr: Uint8Array, price: number, time: number, decimal: number, name: string, priceType: string }) {
      if (fields) {
        this.addr = new PublicKey(fields.addr);
        this.price = fields.price;
        this.decimal = fields.decimal;
        this.time = fields.time;
        this.name = fields.name;
        this.priceType = fields.priceType;
      }
    }
  }
  
  /**
   * Borsh schema definition for answer accounts
   */
  const AnswerSchema = new Map([
    [AnswerAccount, {kind: 'struct', fields: [['addr', [32]], ['price', 'u64'], ['decimal', 'u64'], ['time', 'u64'], ['name', 'string'], ['priceType', 'string']]}],
  ]);
  
  /**
   * The expected size of each answer account.
   */
  const ANSWER_SIZE = 3 * 8 + 32 + 100 * 2;/*borsh.serialize(AnswerSchema, new AnswerAccount()).length;*/
  
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
      const {feeCalculator} = await connection.getRecentBlockhash();
  
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
  
    console.log(
      'Using account',
      payer.publicKey.toBase58(),
      'containing',
      lamports / LAMPORTS_PER_SOL,
      'SOL to pay for fees',
    );
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
    console.log(`Using program ${programId.toBase58()}`);
  
    // Derive the address (public key) of a answer account from the program so that it's easy to find later.
    const ORALE_SEED = 'Banksea Oracle Example';
    answerPubkey = await PublicKey.createWithSeed(
      payer.publicKey,
      ORALE_SEED,
      programId,
    );
  
    // Check if the answer account has already been created
    const answerAccount = await connection.getAccountInfo(answerPubkey);
    if (answerAccount === null) {
      console.log(
        'Creating answer account',
        answerPubkey.toBase58(),
        'to get value from feed account',
      );
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
  

  export async function callProgram(): Promise<void> {
    let feed = {    
      pubkey: new PublicKey('7bZdZK1zqXTb1pCGp7oQ9dXW14SZmBgzpa9ooARbi4Hb'),
      isSigner: false,
      isWritable: false,
    };

    let answer = {
      pubkey: answerPubkey, 
      isSigner: false, 
      isWritable: true 
    };

    const instruction = new TransactionInstruction({
      keys: [feed, answer],
      programId,
      data: Buffer.alloc(0),
    });

    await sendAndConfirmTransaction(
      connection,
      new Transaction().add(instruction),
      [payer],
    );
  }
  
  /**
   * Report the detail of answer account 
   */
  export async function reportAnswer(): Promise<void> {
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
      answerInfo.name,
      `[${answerInfo.addr}]`,
      'price is',
      answerInfo.price / (10**answerInfo.decimal),
      answerInfo.priceType,
      'updated on ',
      `<${new Date (answerInfo.time * 1000).toString()}>`,
    );
  }