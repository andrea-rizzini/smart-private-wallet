import { deleteDir } from "../src/utils/deleteDir";
import { deleteUsers, deleteKeypairs, deleteContacts, deleteNullifiers } from "./database";

deleteUsers();
deleteKeypairs();
deleteContacts();
deleteNullifiers();

deleteDir("apps/version1_onboarding/data");