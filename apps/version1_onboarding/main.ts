import figlet from 'figlet';
import * as readline from 'readline';
import { acceptInvite, alreadyRegistered, onboardViaLink } from '../../src/walletFirstActions';
import { inputFromCLI } from '../../src/utils/inputFromCLI';

async function main() {

  await figlet('Smart  private  wallet  v1 !', function(err, data) {
      if (err) {
        console.log('Something went wrong...');
        console.dir(err);
        return;
      }
      console.log(data);
  });
  console.log('\nWelcome to smart private wallet version 1');
  console.log('\nThis wallet is aimed to demonstrate how a privatized onboarding process can be implemented on ethereum');

  let isCorrectCode = false;
  
  while (!isCorrectCode) {

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await inputFromCLI('\n[1] Accept invite (via invitation code) \n[2] Already have an account  \n[3] Onboard via link\n: ', rl);

    rl.close();
    
    if (answer === '1') {
      await acceptInvite();
      isCorrectCode = true;
    } else if (answer === '2') {    
      // not in our scope
      isCorrectCode = true;
      await alreadyRegistered();
    } else if (answer === '3') {
      isCorrectCode = true;
      await onboardViaLink();
    }
    else {
      console.log('Invalid input.');
    }
  }
    
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })