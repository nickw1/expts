
const User = require('./user');
const bcrypt = require('bcrypt');

class OAuthModel {

    constructor(db) {
        this.db = db;
    }

    // get the client object; doesn't check the secret if it's null
    async getClient(clientId, clientSecret = null) {
        try {
            const dbres =  await this.db.query('SELECT * FROM oauth_clients WHERE client_id=$1', [clientId]);
            if(dbres.rows.length == 1 && 
                (clientSecret === null || 
                    await bcrypt.compare(clientSecret, dbres.rows[0].client_secret.replace('$2y$', '$2b$')))) {
                const client= {
                       clientId: clientId,
                    clientSecret: clientSecret, 
                    redirectUris : [dbres.rows[0].redirect_uri],
                    grants: dbres.rows[0].grant_types.split(' ')
                };
                return client;
            } else {
                console.error(`getClient(): unable to find a client with ${clientId} and ${clientSecret}`);
                return false;
            }
        } catch(e) {
            console.error(`getClient(): ERROR ${e}`);
            return false;
        }
    }

    // Gets the full authorisation code object from an access token ID
    // note the client and user are returned as objects, not IDs
    async getAuthorizationCode(authorizationCode) {
        try {
            const dbres = await this.db.query('SELECT * FROM oauth_auth_codes WHERE auth_code=$1 AND revoked=false', [authorizationCode]);
            if(dbres.rows.length == 1) {
                const date1 = new Date(parseInt(dbres.rows[0].expires));
                const code =  {
                    authorizationCode: dbres.rows[0].auth_code,
                    expiresAt: new Date(parseInt(dbres.rows[0].expires)), 
                    scope: dbres.rows[0].scope,
                    client: await this.getClient(dbres.rows[0].client_id),//object representing client app has to have id field,
                    user: await this.getUser(dbres.rows[0].user_id) 
                };
                return code;
            } else {
                console.error(`Cannot find an auth code for : ${authorizationCode}`);
                return false;
            }
        } catch(e) {
            console.error(`getAuthorizationCode(): ERROR ${e}`);
            return false;
        }    
    }

    // Gets the full access token object from an access token ID
    // note the client and user are returned as objects, not IDs
    async getAccessToken(accessToken) {
        try {
            const dbres = await this.db.query('SELECT * FROM oauth_access_tokens WHERE access_token=$1 AND revoked=false', [accessToken]);
            if(dbres.rows.length == 1) {
                const at = {
                    accessToken: dbres.rows[0].access_token,
                    accessTokenExpiresAt: new Date(parseInt(dbres.rows[0].expires)), 
                    scope: dbres.rows[0].scope,
                    client: await this.getClient(dbres.rows[0].client_id),//object representing client app has to have id field,
                    user: await this.getUser(dbres.rows[0].userid) 
                };
                return at;
            } else {
                console.error(`Cannot find an access token for : ${accessToken}`);
                return false; 
            }
        } catch(e) {
            console.error(`getAccessToken(): ERROR ${e}`);
            return false;
        }    
    }

    async getUser(id) {
        const user = new User(this.db);
        return user.fromId(id);
    }    

    // saves a token
    async saveToken(token, client, user) {
        if(token.accessToken) {
            try {
                const dbres = await this.db.query('INSERT INTO oauth_access_tokens(client_id,userid,scope,access_token,expires) VALUES ($1, $2, $3, $4, $5)', [client.clientId, user.userid, token.scope, token.accessToken, token.accessTokenExpiresAt.getTime()]);
                token.client = client;
                token.user = user;
                return token; // 14gasher example returns the token
            } catch(e) {
                console.error(`saveToken() ERROR ${e}`);
                return false;
            }
        }
        return false;
    }

    
    // saves an authorisation code 
    // client and user are objects
    async saveAuthorizationCode(code, client, user) {
        try {
            code.client = client;
            code.user = user;
            if(code.authorizationCode) {
                const dbres = await this.db.query('INSERT INTO oauth_auth_codes(client_id,user_id,scope,auth_code,expires) VALUES ($1, $2, $3, $4, $5)', [code.client.clientId, user, code.scope, code.authorizationCode, code.expiresAt.getTime()]);
                return code;
            }
            return false;
        } catch(e) {
            console.error(`saveAuthorizationCode() ERROR ${e}`);
            return false;
        }
    }

    async revokeToken(token) {
        try {
            const dbres = await this.db.query('UPDATE oauth_access_tokens SET revoked=true WHERE access_token=$1', [token.accessToken]);
            return true;
        } catch(e) {
            return false;
        }
    }

    async revokeAuthorizationCode(code) {
        try {
            const dbres = await this.db.query('UPDATE oauth_auth_codes SET revoked=true WHERE auth_code=$1', [code.authorizationCode]);
            return true;
        } catch(e) {
            return false;
        }
    }

    // checks that the scope(s) of an access token are in a space-separated 
    // list of scopes (as returned from the database)
    // every scope of the access token must be in the requested scopes
    // reuqestedScope is a scope of an API so the access token has to allow
    // this scope
    verifyScope(accessToken, requestedScope) {
        const apiScopes = requestedScope.split(' '); 
        return accessToken.scope.split(' ').every(s => apiScopes.indexOf(s) >= 0);
    }

    // gets all scopes in existence - returns an array of all rows
    async getScopes() {
        try {
            const dbres = await this.db.query('SELECT * FROM oauth_scopes');
            return dbres.rows;
        } catch(e) {
            return false;
        }
    }
}

module.exports = OAuthModel; 
