import { getUsers } from "./database";

getUsers().forEach(user => {
    console.log(user);
});