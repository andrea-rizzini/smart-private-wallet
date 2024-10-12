import { getUsers, getContacts, getKeypairs, getKeypairsOnboarding, getNullifiers } from "./database";

console.log('Users:\n');
getUsers().forEach(user => {
    console.log(user);
});

console.log('\nContacts:\n');
getContacts().forEach(contact => {
    console.log(contact);
});

console.log('\nKeypairs:\n');
getKeypairs().forEach(keypair => {
    console.log(keypair);
});

console.log('\nKeypairs Onboarding:\n');
getKeypairsOnboarding().forEach(keypair => {
    console.log(keypair);
});

console.log('\nNullifiers:\n');
getNullifiers().forEach(nullifier => {
    console.log(nullifier);
});