const Router = require('express-promise-router');
const router = new Router();

//const request = require('request');
//const parser = require('fast-xml-parser');
//const qs = require('querystring');


const passport = require('passport');
const OpenStreetMapStrategy = require('passport-openstreetmap').Strategy;
const AsyncSessionTokenStore = require('../models/asyncsessiontokenstore');

passport.use(new OpenStreetMapStrategy({
        consumerKey: process.env.OAUTH_KEY,
        consumerSecret: process.env.OAUTH_SECRET,
        callbackURL: process.env.OAUTH_CALLBACK,
        requestTokenURL: "https://www.openstreetmap.org/oauth/request_token",
        accessTokenURL: "https://www.openstreetmap.org/oauth/access_token",
        userAuthorizationURL: "https://www.openstreetmap.org/oauth/authorize",
        requestTokenStore: new AsyncSessionTokenStore({key: 'oauth'})
    }, (token, tokenSecret, profile, done)=> {
        return done(null, {userid: `o${profile.id}`, username: profile.displayName, isadmin: 0, osm: true});
    }
));

router.get('/login', 
    passport.authenticate('openstreetmap')
);

router.get('/callback', 
    passport.authenticate('openstreetmap', { failureRedirect: 'login' }),
    (req, res) => {
        res.redirect('../..');
    }
);

// This (based on the example on the OSM wiki) works, however 'request'
// is now deprecated, so looking for a replacement or will investigate fixing
// passport-openstreetmap.
/*
router.get('/login', (req, res) => {
    request.post({
        url: 'https://www.openstreetmap.org/oauth/request_token',
        oauth: {
            callback: process.env.OAUTH_CALLBACK,
            consumer_key: process.env.OAUTH_KEY, 
            consumer_secret: process.env.OAUTH_SECRET 
        }
    }, (err, result, body) => {
        if(err) { 
            console.error(err); 
            res.send(err);
        }
        else {
            const data = qs.parse(body);
            req.session.oauth_token = data.oauth_token;
            req.session.oauth_token_secret = data.oauth_token_secret;
            req.session.save( () => {
                res.redirect(`https://www.openstreetmap.org/oauth/authorize?oauth_token=${data.oauth_token}`);
            });
        }
    }
    );
});

router.get('/callback', (req, res) => {    
    request.post({
        url: 'https://www.openstreetmap.org/oauth/access_token',
        oauth: {
            consumer_key: process.env.OAUTH_KEY, 
            consumer_secret: process.env.OAUTH_SECRET,
            token: req.query.oauth_token,
            token_secret: req.session.oauth_token_secret,
            verifier: req.query.oauth_verifier
        }
    }, (err, result, body) => {
        if(err) {
            res.send(err);
        } else {
            const data = qs.parse(body);
            const accessToken = data.oauth_token;
            const accessSecret = data.oauth_token_secret;
            request({
                url: 'https://www.openstreetmap.org/api/0.6/user/details',
                method: 'GET',
                oauth: {
                    consumer_key: process.env.OAUTH_KEY,
                    consumer_secret: process.env.OAUTH_SECRET, 
                    token: accessToken,
                    token_secret: accessSecret,
                }, headers: {
                    'Content-Type': 'text/xml'
                }
            }, (err, result, body)=> {
                if(err){ res.send(err); }
                else {
                    const doc= parser.parse(body, { ignoreAttributes: false});
                    const userid = doc.osm.user['@_id'];
                    const displayName = doc.osm.user['@_display_name'];
                    if(userid && displayName) {
                        req.session.osmUser = {
                            userid : `o${userid}`,
                            displayName: displayName
                        };
                        req.session.save( ()=> {
                            res.redirect('../..');
                        });
                    } else {
                        res.send('user details not found');
                    }
                }
            });
        }
    });
});
*/
module.exports = router;
