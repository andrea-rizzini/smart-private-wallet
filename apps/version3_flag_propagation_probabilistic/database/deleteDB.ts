import { deleteDir } from "../src/utils/deleteDir";
import { deleteUsers, deleteKeypairs, deleteKeypairsOnboarding, deleteChallenges, deleteContacts, deleteMaskedCommitments, deleteNullifiers } from "./database";

deleteUsers();
deleteKeypairs();
deleteKeypairsOnboarding();
deleteContacts();
deleteChallenges();
deleteMaskedCommitments();
deleteNullifiers();

deleteDir("apps/version3_flag_propagation_probabilistic/data");