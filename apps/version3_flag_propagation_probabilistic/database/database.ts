import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const dbDir = path.join(__dirname, '../data');
const dbPath = path.join(dbDir, 'version3_flag_propagation_probabilistic.db');

if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

export const createTables = () => {
    const createTableSQL = `
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE, -- unique Username
            passwordHash TEXT NOT NULL -- Password
        );
    `;

    const createKeypairTableSQL = `
        CREATE TABLE IF NOT EXISTS keypair (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId INTEGER UNIQUE, 
            privkey TEXT NOT NULL,  
            pubkey TEXT NOT NULL,   
            encryptionKey TEXT NOT NULL, 
            FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE 
        );
    `;

    const createKeypairOnboardingTableSQL = `
        CREATE TABLE IF NOT EXISTS keypairOnboarding (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId INTEGER UNIQUE, 
            privkey TEXT NOT NULL,  
            pubkey TEXT NOT NULL,   
            encryptionKey TEXT NOT NULL, 
            FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE 
        );
    `;

    const createContactsTableSQL = `
        CREATE TABLE IF NOT EXISTS contacts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId INTEGER,
            name TEXT NOT NULL UNIQUE, 
            address TEXT NOT NULL, 
            FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
        );
    `;

    const createUserNullifiersTableSQL = `
        CREATE TABLE IF NOT EXISTS user_nullifiers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId INTEGER, 
            name TEXT NOT NULL,
            nullifier TEXT NOT NULL, 
            amount REAL NOT NULL,
            redeemed BOOLEAN NOT NULL DEFAULT FALSE, 
            FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE 
        );
    `;

    const createChallengeTableSQL = `
        CREATE TABLE IF NOT EXISTS challenges (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId INTEGER,
            name TEXT NOT NULL,
            challenge TEXT NOT NULL, 
            redeemed BOOLEAN NOT NULL DEFAULT FALSE,
            FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE 
        );
    `;

    const createMaskedCommitmentsTableSQL = `
        CREATE TABLE IF NOT EXISTS masked_commitments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            depositorAddress TEXT NOT NULL,
            commitment TEXT NOT NULL,
            blinding TEXT NOT NULL,
            maskedCommitment TEXT NOT NULL,
            flagged BOOLEAN NOT NULL DEFAULT FALSE            
        );
    `;

    db.exec(createTableSQL); 

    db.exec(createKeypairTableSQL);

    db.exec(createKeypairOnboardingTableSQL);

    db.exec(createContactsTableSQL);

    db.exec(createUserNullifiersTableSQL);

    db.exec(createChallengeTableSQL);

    db.exec(createMaskedCommitmentsTableSQL);
};


export const insertUser = (username: string, passwordHash: string) => {
    const insertSQL = `INSERT INTO users (username, passwordHash) VALUES (?, ?);`;
    const stmt = db.prepare(insertSQL);
    const info = stmt.run(username, passwordHash); 
    const index: number = info.lastInsertRowid as number; 
    return index;
};

export const insertKeypair = (userId: number, privkey: string, pubkey: string, encryptionKey: string) => {
    const insertSQL = `INSERT INTO keypair (userId, privkey, pubkey, encryptionKey) VALUES (?, ?, ?, ?);`;
    const stmt = db.prepare(insertSQL);
    stmt.run(userId, privkey, pubkey, encryptionKey); 
}

export const insertKeypairOnboarding = (userId: number, privkey: string, pubkey: string, encryptionKey: string) => {
    const insertSQL = `INSERT INTO keypairOnboarding (userId, privkey, pubkey, encryptionKey) VALUES (?, ?, ?, ?);`;
    const stmt = db.prepare(insertSQL);
    stmt.run(userId, privkey, pubkey, encryptionKey); 
}

export const insertContact = (userId: number, name: string, address: string) => {
    const insertSQL = `INSERT INTO contacts (userId, name, address) VALUES (?, ?, ?);`;
    const stmt = db.prepare(insertSQL);
    stmt.run(userId, name, address); 
}

export const insertChallenge = (userId: number, name: string, challenge: string) => {
    const insertSQL = `INSERT INTO challenges (userId, name, challenge) VALUES (?, ?, ?);`;
    const stmt = db.prepare(insertSQL);
    stmt.run(userId, name, challenge); 
}

export const insertUserNullifier = (userId: number, name: string, nullifier: string, amount: number) => {
    const insertSQL = `INSERT INTO user_nullifiers (userId, name, nullifier, amount) VALUES (?, ?, ?, ?);`;
    const stmt = db.prepare(insertSQL);
    stmt.run(userId, name, nullifier, amount); 
}

export const insertMaskedCommitment = (depositorAddress: string, commitment: string, blinding: string, maskedCommitment: string) => {
    const insertSQL = `INSERT INTO masked_commitments (depositorAddress, commitment, blinding, maskedCommitment) VALUES (?, ?, ?, ?);`;
    const stmt = db.prepare(insertSQL);
    const info = stmt.run(depositorAddress, commitment, blinding, maskedCommitment); 
    const index: number = info.lastInsertRowid as number;
    return index;
}

export const getTupleFromDepositorAddress = (depositorAddress: string) => {
    const selectSQL = `SELECT * FROM masked_commitments WHERE depositorAddress = ?;`;
    const stmt = db.prepare(selectSQL);
    return stmt.get(depositorAddress);
}

export const getUsers = () => {
    const selectSQL = `SELECT * FROM users;`;
    const stmt = db.prepare(selectSQL);
    return stmt.all();
}

export const getKeypairs = () => {
    const selectSQL = `SELECT * FROM keypair;`;
    const stmt = db.prepare(selectSQL);
    return stmt.all();
}

export const getKeypairsOnboarding = () => {
    const selectSQL = `SELECT * FROM keypairOnboarding;`;
    const stmt = db.prepare(selectSQL);
    return stmt.all();
}

export const getContacts = () => {
    const selectSQL = `SELECT * FROM contacts;`;
    const stmt = db.prepare(selectSQL);
    return stmt.all();
}

export const getNullifiers = () => {
    const selectSQL = `SELECT * FROM user_nullifiers;`;
    const stmt = db.prepare(selectSQL);
    return stmt.all();
}

export const getChallenges = () => {
    const selectSQL = `SELECT * FROM challenges;`;
    const stmt = db.prepare(selectSQL);
    return stmt.all();
}

export const getMaskedCommitments = () => {
    const selectSQL = `SELECT * FROM masked_commitments;`;
    const stmt = db.prepare(selectSQL);
    return stmt.all();
}

export const getIdAndMaskedCommitmentByDepositorAddress = (depositorAddress: string) => {
    const selectSQL = `SELECT id, maskedCommitment FROM masked_commitments WHERE depositorAddress = ?;`;
    const stmt = db.prepare(selectSQL);
    return stmt.get(depositorAddress);
}

export const getAddressOfContactOfUser = (userId: number, name: string) => {

    interface ContactAddress {
        address: string;
    }

    const selectSQL = `SELECT address FROM contacts WHERE userId = ? AND name = ?;`;
    const stmt = db.prepare(selectSQL);
    const result = stmt.get(userId, name) as ContactAddress | undefined;

    return result?.address; 
}

export const updateContact = (userId: number, name: string, address: string) => {
    const updateSQL = `UPDATE contacts SET address = ? WHERE userId = ? AND name = ?;`;
    const stmt = db.prepare(updateSQL);
    stmt.run(address, userId, name);
}

export const getUserNullifiers = () => {
    const selectSQL = `SELECT * FROM user_nullifiers;`;
    const stmt = db.prepare(selectSQL);
    return stmt.all();
}

export const getKeyPairByUserId = (userId: number) => {
    const selectSQL = `SELECT privkey, pubkey, encryptionKey FROM keypair WHERE userId = ?;`;
    const stmt = db.prepare(selectSQL);
    return stmt.get(userId);
}

export const getKeyPairOnboardingByUserId = (userId: number) => {
    const selectSQL = `SELECT privkey, pubkey, encryptionKey FROM keypairOnboarding WHERE userId = ?;`;
    const stmt = db.prepare(selectSQL);
    return stmt.get(userId);
}

export const getContactsByUserId = (userId: number) => {
    const selectSQL = `SELECT name, address FROM contacts WHERE userId = ?;`;
    const stmt = db.prepare(selectSQL);
    return stmt.all(userId);
}

export const getUserNullifiersByUserId = (userId: number) => {
    const selectSQL = `SELECT name, nullifier, amount, redeemed  FROM user_nullifiers WHERE userId = ?;`;
    const stmt = db.prepare(selectSQL);
    return stmt.all(userId);
}

export const getUnredeemedNullifiersByUserId = (userId: number) => {
    const selectSQL = `SELECT name, nullifier, amount, redeemed FROM user_nullifiers WHERE userId = ? AND redeemed = FALSE;`;
    const stmt = db.prepare(selectSQL);
    return stmt.all(userId);
}

export const updateNullifierRedeemed = (userId: number, nullifier: string) => {
    const updateSQL = `UPDATE user_nullifiers SET redeemed = TRUE WHERE userId = ? AND nullifier = ?;`;
    const stmt = db.prepare(updateSQL);
    stmt.run(userId, nullifier);
}

export const updateChallengeRedeemed = (userID: number, challenge: string) => {
    const updateSQL = `UPDATE challenges SET redeemed = TRUE WHERE userId = ? AND challenge = ?;`;
    const stmt = db.prepare(updateSQL);
    stmt.run(userID, challenge);
}

export const updateMaskedCommitmentFlagged = (maskedCommitment: string) => {
    const updateSQL = `UPDATE masked_commitments SET flagged = TRUE WHERE maskedCommitment = ?;`;
    const stmt = db.prepare(updateSQL);
    stmt.run(maskedCommitment);
}

export const getChallengeByNameAndUserID = (userId: number, name: string) => {
    const selectSQL = `SELECT challenge FROM challenges WHERE name = ?;`;
    const stmt = db.prepare(selectSQL);
    return stmt.get(userId, name);
}

export const isChallengeRedeemed = (userId: number, challenge: string) => {
    const selectSQL = `SELECT redeemed FROM challenges WHERE userId = ? AND challenge = ?;`;
    const stmt = db.prepare(selectSQL);
    const result = stmt.get(userId, challenge);
    // @ts-ignore
    return result.redeemed;
}

export const usernameExists = (username: string): boolean => {
    const query = `SELECT COUNT(*) as count FROM users WHERE username = ?;`
    const stmt = db.prepare(query);
    const result = stmt.get(username);
    // @ts-ignore
    return result.count > 0;
};


export const getUserByUsername = (username: string) => {
    const query = `SELECT * FROM users WHERE username = ?;`
    const stmt = db.prepare(query);
    return stmt.get(username);
}

export const getID = (username: string): number => {
    const query = `SELECT id FROM users WHERE username = ?;`
    const stmt = db.prepare(query);
    const result = stmt.get(username);
    // @ts-ignore
    return result.id;
}

export const deleteUser = (id: number) => {
    const deleteSQL = `DELETE FROM users WHERE id = ?;`;
    const stmt = db.prepare(deleteSQL);
    stmt.run(id);
}

export const deleteUsers = () => {
    const deleteSQL = `DELETE FROM users;`;
    db.exec(deleteSQL);
}

export const deleteKeypairs = () => {
    const deleteSQL = `DELETE FROM keypair;`;
    db.exec(deleteSQL);
}

export const deleteKeypairsOnboarding = () => {
    const deleteSQL = `DELETE FROM keypairOnboarding;`;
    db.exec(deleteSQL);
}

export const deleteContacts = () => {
    const deleteSQL = `DELETE FROM contacts;`;
    db.exec(deleteSQL);
}

export const deleteNullifiers = () => {
    const deleteSQL = `DELETE FROM user_nullifiers;`;
    db.exec(deleteSQL);
}

export const deleteChallenges = () => {
    const deleteSQL = `DELETE FROM challenges;`;
    db.exec(deleteSQL);
}

export const deleteMaskedCommitments = () => {
    const deleteSQL = `DELETE FROM masked_commitments;`;
    db.exec(deleteSQL);
}