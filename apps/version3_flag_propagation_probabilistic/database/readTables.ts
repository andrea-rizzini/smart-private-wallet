import { getUsers, getContacts, getChallenges, getKeypairs, getKeypairsOnboarding, getMaskedCommitments, getNullifiers } from "./database";

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

console.log('\nMasked Commitments:\n');
getMaskedCommitments().forEach(maskedCommitment => {
    console.log(maskedCommitment);
});

console.log('\nNullifiers:\n');
getNullifiers().forEach(nullifier => {
    console.log(nullifier);
});

console.log('\nChallenges:\n');
getChallenges().forEach(challenge => {
    console.log(challenge);
});

