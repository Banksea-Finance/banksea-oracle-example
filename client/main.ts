import {
  establishConnection,
  establishPayer,
  checkProgram,
  getPriceOnEthereum,
  getPriceOnSolana,
} from './oracle';

async function main() {
  // Establish connection to the cluster
  await establishConnection();

  // Determine who pays for the fees
  await establishPayer();

  // Check if the program has been deployed
  await checkProgram();

  // A example for getting price on Ethereum
  await getPriceOnEthereum();

  // A example for getting price on Solana
  await getPriceOnSolana();
}

main().then(
  () => process.exit(),
  err => {
    console.error(err);
    process.exit(-1);
  },
);