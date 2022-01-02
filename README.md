# Banksea Oracle Example
This repo is an example guiding you to  use the banksea oracle in your program
### Environment Setup
* Install Rust from https://rustup.rs/

* Install Solana from https://docs.solana.com/cli/install-solana-cli-tools#use-solanas-install-tool

### Clone this repo
```
$ git clone https://github.com/Banksea-Finance/banksea-oracle-example.git
```
### Install the dependencies
```
$ npm install
```
### Build the program
```
$ cargo build-bpf
```
### Set solana cluster to devnet
```
$ solana config set --url devnet
```
### Request airdrop for test
```
$ solana airdrop 2
```
### Deploy the program
```
$ solana program deploy target/deploy/solana_oracle_example.so
```
### Run the client to test example
Run the following command to test the example program:
```
$ ts-node client/main.ts
```
Then, the result will be print, like following:
```
Connection to cluster established: https://api.devnet.solana.com { 'feature-set': 2385070269, 'solana-core': '1.8.11' }
Using account 2z6Du6hGQZvFXJ8HbtYc1JAfrn2ukHnQqdvCEShk1eg6 containing 1.019314762 SOL to pay for fees
Using program 7zU7sSudHNTrpcMNCCiXXb7te2eFAeS3j7AZ6xGQTxRF
DAPE #1 [Gp6izRWvMT9abbN73qAMBXwBqUzWCmikLtwj4YxWLy8W] price is 0.1 SOL updated on  <Fri Sep 05 2251 23:48:08 GMT+0800 (China Standard Time)>
```