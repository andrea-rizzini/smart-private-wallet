import { deleteDir } from "../src/utils/deleteDir";
import { deleteUsers, deleteKeypairs, deleteKeypairsOnboarding, deleteChallenges, deleteContacts, deleteNullifiers } from "./database";

deleteUsers();
deleteKeypairs();
deleteKeypairsOnboarding();
deleteContacts();
deleteChallenges();
deleteNullifiers();

deleteDir("apps/version3_flag_propagation/data");