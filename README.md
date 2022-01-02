# Solana Oracle Example
### Environment Setup
1. Install Rust from https://rustup.rs/
2. Install Solana from https://docs.solana.com/cli/install-solana-cli-tools#use-solanas-install-tool


### Install the dependencies
```
$ npm install
```
### Build the program compiled for BPF
```
$ cargo build-bpf
```
### deploy the program compiled for BPF
```
$ solana program deploy target/deploy/solana_oracle_example.so
```
### Run the client to test example
```
$ ts-node client/main.ts
```