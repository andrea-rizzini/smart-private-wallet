import Database from 'better-sqlite3';

const db = new Database('version3_compliance.db');

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

    const createContactsTableSQL = `
        CREATE TABLE IF NOT EXISTS contacts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId INTEGER,
            name TEXT NOT NULL, 
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

    db.exec(createTableSQL); 

    db.exec(createKeypairTableSQL);

    db.exec(createContactsTableSQL);

    db.exec(createUserNullifiersTableSQL);
};


export const insertUser = (username: string, passwordHash: string) => {
    const insertSQL = `INSERT INTO users (username, passwordHash) VALUES (?, ?);`;
    const stmt = db.prepare(insertSQL);
    const info = stmt.run(username, passwordHash); 
    const index: number = info.lastInsertRowid as number; 
    // console.log(`\nUser correctly inserted with ID: ${index}`);
    return index;
};

export const insertKeypair = (userId: number, privkey: string, pubkey: string, encryptionKey: string) => {
    const insertSQL = `INSERT INTO keypair (userId, privkey, pubkey, encryptionKey) VALUES (?, ?, ?, ?);`;
    const stmt = db.prepare(insertSQL);
    stmt.run(userId, privkey, pubkey, encryptionKey); 
}

export const insertContact = (userId: number, name: string, address: string) => {
    const insertSQL = `INSERT INTO contacts (userId, name, address) VALUES (?, ?, ?);`;
    const stmt = db.prepare(insertSQL);
    stmt.run(userId, name, address); 
}

export const insertUserNullifier = (userId: number, name: string, nullifier: string, amount: number) => {
    const insertSQL = `INSERT INTO user_nullifiers (userId, name, nullifier, amount) VALUES (?, ?, ?, ?);`;
    const stmt = db.prepare(insertSQL);
    stmt.run(userId, name, nullifier, amount); 
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

export const getContacts = () => {
    const selectSQL = `SELECT * FROM contacts;`;
    const stmt = db.prepare(selectSQL);
    return stmt.all();
}

export const getContactOfUser = (userId: number, name: string) => {
    const selectSQL = `SELECT * FROM contacts WHERE userId = ? AND name = ?;`;
    const stmt = db.prepare(selectSQL);
    return stmt.get(userId, name);
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
