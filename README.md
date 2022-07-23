# Banksea Oracle Example
This repo is an example guiding you to use the banksea oracle in your program.

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

###  Deploy the program

``` shell 
$ solana program deploy target/deploy/banksea_oracle_example.so
```

### Run the test client

Run the following command to test the example program:
```shell
$ ts-node client/main.ts
```
Then, the result will be print, like following:
```shell
Answer Information: 
        degods 
        floor price is 269 SOL 
        AI floor price is 269 SOL 
        avg price is 360 SOL 
        updated on 'Fri, 22 Jul 2022 08:00:14 GMT'
```