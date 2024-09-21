import { getKeypairs } from "./database";

getKeypairs().forEach(keypair => {
    console.log(keypair);
});