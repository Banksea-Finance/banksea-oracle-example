/**
 * Hello world
 */

import {
  establishConnection,
  establishPayer,
  checkProgram,
  callProgram,
  reportAnswer,
} from './oracle';

async function main() {
  // Establish connection to the cluster
  await establishConnection();

  // Determine who pays for the fees
  await establishPayer();

  // Check if the program has been deployed
  await checkProgram();

  // Say hello to an account
  await callProgram();

  // Find out how many times that account has been greeted
  await reportAnswer();

  console.log('Success');
}

main().then(
  () => process.exit(),
  err => {
    console.error(err);
    process.exit(-1);
  },
);