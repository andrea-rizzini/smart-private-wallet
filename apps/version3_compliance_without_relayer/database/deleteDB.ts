import { deleteUsers, deleteKeypairs, deleteContacts, deleteNullifiers } from "./database";
import { deleteDir } from "../src/utils/deleteDir";

deleteUsers();
deleteKeypairs();
deleteContacts();
deleteNullifiers();

deleteDir("apps/version3_compliance_without_relayer/data");

