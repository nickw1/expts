const Router = require('express-promise-router');
const router = new Router();
const db = require('openpanos-server/db');
const User = require('../models/user');
const OAuthServer = require('../bundled_modules/express-oauth-server');
const OAuthModel = require('../models/oauth');
const PanoController = require('openpanos-server/controllers/panorama');
router.oauthModel = new OAuthModel(db);

router.oauth = new OAuthServer({
    model: router.oauthModel,
    grants: ['authorization_code'],
    accessTokenLifetime: 60*60*24,
    allowEmptyState: false
});

router.all('/api/*',
    router.oauth.authenticate(),
    (req, res, next)=> {
        req.user = {
            userid: res.locals.oauth.token.user.userid,
            isadmin: res.locals.oauth.token.user.isadmin
        };
        req.oauthScope = res.locals.oauth.token.scope ? res.locals.oauth.token.scope.split(' '): [];
        res.locals.oauth = null;
        next();
});

router.post('/api/upload', (req, res, next) => {
    if(req.user && req.user.userid && req.oauthScope.indexOf("upload") > -1) {
        const panorama = new PanoController();
        panorama.uploadPano(req, res);
    } else {
        res.status(401).json({error: 'Unauthorised access to OAuth upload API.'});
    }
});

// all authorize requests force login if user not logged in already
router.use('/auth/authorize', async (req, res, next)=> {
    if(!req.session.authRequest && req.query) {
        req.session.authRequest = {
            client_id: req.query.client_id,
            redirect_uri: req.query.redirect_uri,
            state: req.query.state,
            grant_type: 'authorization_code',
            response_type: 'code'
        };
    }
    if(!req.user || !req.user.userid) { 
        req.session.save( (err) => {
            if(err) {
                res.status(500).json({error: err});
            } else {
                res.redirect('/oauth/login?redirect=/oauth/auth/authorize');
            }
        });
    } else {
        next();
    }
});

router.get('/auth/authorize', async(req, res, next) => {
    const scopes = await router.oauthModel.getScopes();
    res.render('authorise', { 
        scopes: scopes,     
        title: 'Authorise the client?'
    } );
});


// once user has actually authorised
router.post('/auth/authorize', (req, res, next) => {
    Object.keys(req.session.authRequest).forEach (k => {
        req.body[k] = req.session.authRequest[k];
    });
    req.body.scope = req.body.scope || "";
    if(typeof(req.body.scope) != 'string') {
        req.body.scope =  req.body.scope.join(' ');
    }
    req.session.authRequest = null;
    next();
}, router.oauth.authorize({
    authenticateHandler: {
        handle: req => {
            return req.user.userid;
        }
    }
})
);

router.post('/auth/access_token', router.oauth.token());

router.get('/login', (req,res)=> {
    res.render('login', { 
        title: 'Login to OTV',
        hiddenFields: {
            redirect: req.query.redirect || null
        }
    } );
});

module.exports = router;


