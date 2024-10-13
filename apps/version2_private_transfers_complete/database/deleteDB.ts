import { deleteDir } from "../src/utils/deleteDir";
import { deleteUsers, deleteKeypairs, deleteKeypairsOnboarding, deleteChallenges, deleteContacts, deleteNullifiers } from "./database";

deleteUsers();
deleteKeypairs();
deleteKeypairsOnboarding();
deleteContacts();
deleteChallenges();
deleteNullifiers();

deleteDir("apps/version2_private_transfers_complete/data");