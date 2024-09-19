import figlet from 'figlet';
import * as readline from 'readline';
import { acceptInvite, onboardViaLink } from '../version2_private_transfers/src/walletFirstActions';
import { inputFromCLI } from '../version2_private_transfers/src/utils/inputFromCLI';

async function main() {

  await figlet('Smart  private  wallet  v2 !', function(err, data) {
      if (err) {
        console.log('Something went wrong...');
        console.dir(err);
        return;
      }
      console.log(data);
  });
  console.log('\nWelcome to smart private wallet version 2');
  console.log('\nThis wallet is aimed to demonstrate how private internal transfers work, once you have completed the onboarding to the wallet.');

  let isCorrectCode = false;
  
  while (!isCorrectCode) {

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await inputFromCLI('\n[1] Accept invite (via invitation code) \n[2] Onboard via link \n[3] Exit \n: ', rl);

    rl.close();
    
    if (answer === '1') {
      await acceptInvite();
      isCorrectCode = true;
    } else if (answer === '2') {
      isCorrectCode = true;
      await onboardViaLink();
    }
    else if (answer === '3') {
      console.log('\nGoodbye!');
      process.exit(0);
    }
    else {
      console.log('\nInvalid input.');
    }
  }
    
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })