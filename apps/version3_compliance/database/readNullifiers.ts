import { getUserNullifiers } from "./database";

getUserNullifiers().forEach((nullifier) => {
    console.log(nullifier);
});