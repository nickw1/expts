const bcrypt = require('bcrypt');

class User {
    constructor(db) {
        this.db = db;
    }

    async login (user, pass) {
        const dbres = await this.db.query('SELECT * FROM users WHERE username=$1', [user]);    
        if(dbres.rows.length == 1) {
            const match = await bcrypt.compare(pass, dbres.rows[0].password.replace('$2y$', '$2b$'));
            if(match === false) {
                return { error: "Invalid login" };
            }
            return {     
                username: user, 
                userid: dbres.rows[0].id, 
                isadmin: dbres.rows[0].isadmin 
            };
        } else {
            return { error: "Invalid login" };
        }
    }

    async fromId(id) {
        const dbres = await this.db.query('SELECT * FROM users WHERE id=$1', [id]);
        if(dbres.rows.length == 1) {
            return { userid: id, username: dbres.rows[0].username, isadmin: dbres.rows[0].isadmin };
        } else {
            return { error: "Invalid user id" };
        }
    }

    async userExists(user) {
        const dbres = await this.db.query('SELECT * FROM users WHERE username=$1', [user]);
        return dbres.rows.length > 0;
    }
    
    async signup(user, pass) {
        const encPass = await bcrypt.hash(pass, 10);
        const dbres = await this.db.query("INSERT INTO users (username, password) VALUES ($1, $2)", [ user, encPass ]);
        return dbres.rowCount == 1 ? { username: user }: { error: 'Failed to add your details.' };
    }
}

module.exports = User;
