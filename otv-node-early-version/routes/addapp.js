const Router = require('express-promise-router');
const router = Router();
const db = require('openpanos-server/db');
const bcrypt = require('bcrypt');
const randomBytes = require('random-bytes');
const validate = require('validate.js');

router.get('/', (req, res) => {
    res.render('addApp');
});

router.post('/', async (req, res) => {
    try {
        const regex = ["\\w+"];
        if(req.body.app_name.match(/\S/) && validate({ website: req.body.redirect_uri }, { website: { url: { schemes: regex, allowLocal:true }}}) === undefined) {
            const clientId = Buffer.from(await randomBytes(16)).toString('hex');
            const clientSecret = Buffer.from(await randomBytes(32)).toString('hex');
            const dbres = await db.query("INSERT INTO oauth_clients (name,redirect_uri,client_id,client_secret,grant_types) VALUES ($1, $2, $3, $4, 'authorization_code')", [req.body.app_name, req.body.redirect_uri, clientId, await bcrypt.hash(clientSecret, 10)] );
            res.render('addApp', {
                clientId: clientId,
                clientSecret: clientSecret
            });
        } else {
            res.render('addApp', {
                error: 'Invalid app name or URL.'
            });
        }
    } catch(e) {
        res.render('addApp', {
            error: e
        });
    }
});

module.exports = router;
