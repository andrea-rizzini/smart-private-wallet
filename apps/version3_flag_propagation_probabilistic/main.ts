import figlet from 'figlet';
import * as readline from 'readline';
import { acceptInvite, login, onboardViaLink } from './src/walletFirstActions';
import { inputFromCLI } from './src/utils/inputFromCLI';

async function main() {

  await figlet('Smart  private  wallet  v3 with probabilistic compliance!', function(err, data) {
      if (err) {
        console.log('Something went wrong...');
        console.dir(err);
        return;
      }
      console.log(data);
  });
  console.log('\nWelcome to smart private wallet version 3 with probabilistic compliance!');

  let isCorrectCode = false;
  
  while (!isCorrectCode) {

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await inputFromCLI('\n[1] Accept invite (via invitation code) \n[2] Already registered \n[3] Onboard via link \n[4] Exit \n: ', rl);

    rl.close();
    
    if (answer === '1') {
      await acceptInvite();
      isCorrectCode = true;
    }
    else if (answer === '2') {
      await login();
      isCorrectCode = true;
    }
    else if (answer === '3') {
      await onboardViaLink();
      isCorrectCode = true;
    }
    else if (answer === '4') {
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