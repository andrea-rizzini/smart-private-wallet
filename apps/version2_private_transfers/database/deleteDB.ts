import { deleteDir } from "../src/utils/deleteDir";
import { deleteUsers, deleteKeypairs, deleteContacts, deleteNullifiers } from "./database";

deleteUsers();
deleteKeypairs();
deleteContacts();
deleteNullifiers();

deleteDir("apps/version2_private_transfers/data");