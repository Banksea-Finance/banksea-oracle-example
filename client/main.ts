import {
  establishConnection,
  establishPayer,
  checkProgram,
  getOracleInfo,
} from './oracle';

async function main() {
  // Establish connection to the cluster
  await establishConnection();

  // Determine who pays for the fees
  await establishPayer();

  // Check if the program has been deployed
  await checkProgram();

  // A example for getting oracle data
  await getOracleInfo();
}

main().then(
  () => process.exit(),
  err => {
    console.error(err);
    process.exit(-1);
  },
);