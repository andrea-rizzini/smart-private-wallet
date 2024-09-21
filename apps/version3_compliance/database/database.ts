import Database from 'better-sqlite3';

const db = new Database('version3_compliance.db');

export const createTable = () => {
    const createTableSQL = `
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE, -- unique Username
            passwordHash TEXT NOT NULL -- Password
        );
    `;
    db.exec(createTableSQL); 
};

export const insertUser = (username: string, passwordHash: string) => {
    const insertSQL = `INSERT INTO users (username, passwordHash) VALUES (?, ?);`;
    const stmt = db.prepare(insertSQL);
    const info = stmt.run(username, passwordHash); 
    const index: number = info.lastInsertRowid as number; 
    // console.log(`\nUser correctly inserted with ID: ${index}`);
    return index;
};

export const usernameExists = (username: string): boolean => {
    const query = `SELECT COUNT(*) as count FROM users WHERE username = ?;`
    const stmt = db.prepare(query);
    const result = stmt.get(username);
    // @ts-ignore
    return result.count > 0;
};

export const getUsers = () => {
    const selectSQL = `SELECT * FROM users;`;
    const stmt = db.prepare(selectSQL);
    return stmt.all();
}

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
