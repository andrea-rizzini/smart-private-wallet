import * as readline from 'readline';

export function inputFromCLI(question: string, rl: readline.Interface) : Promise <string> {
    return new Promise((resolve) => {
      rl.question(question, (input) => {
        resolve(input);
      });
    });
  }

