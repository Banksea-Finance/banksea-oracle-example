# Banksea Oracle Example
This repo is an example guiding you to use the banksea oracle in your program

## Environment Setup

Development requires rust and solana environment:

* Install [Rust](https://rustup.rs/)

* Install [Solana](https://docs.solana.com/cli/install-solana-cli-tools#use-solanas-install-tool)

## Clone the example

Clone the example about Banksea Oracle:

```shell
$ git clone https://github.com/Banksea-Finance/banksea-oracle-example.git
```

## Run the example

This section will guide you how to run the Banksea Oracle example.

### Install the dependencies

``` shell
$ npm install
```

### Build the program

```shell
$ cargo build-bpf
```

### Set Solana cluster to Devnet

```shell
$ solana config set --url devnet
```

### Request airdrop for test

``` shell
$ solana airdrop 2
```

###  Deploy the program

``` shell 
$ solana program deploy target/deploy/solana_oracle_example.so
```

### Run the test client

Run the following command to test the example program:
```shell
$ ts-node client/main.ts
```
Then, the result will be print, like following:
```shell
Connection to cluster established: https://api.devnet.solana.com { 'feature-set': 1006352700, 'solana-core': '1.8.12' }
Answer Information: 
        CryptoPunk #1234 
        source chain = Ethererum 
        price is 66.914393 ETH 
        updated on 'Fri, 21 Jan 2022 07:23:48 GMT'
Answer Information: 
        Degen Ape #6117 
        source chain = Solana 
        price is 15.319274 SOL 
        updated on 'Fri, 21 Jan 2022 07:39:17 GMT'
```