const Router = require('express-promise-router');
const router = new Router();
const User = require('../models/user');
const db = require('openpanos-server/db');
const qs = require('querystring');

const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;

passport.use(new LocalStrategy(async(username, password, done)=> {
    const user = new User(db);
    try {
        const userDetails = await user.login(username, password);
        if(!userDetails.error) {
            return done(null, userDetails);
        } else {
            return done(null, false, { message: userDetails.error } );
        }
    } catch(e) {
        return done(e);
    }
}));
    


router.all('/logout', async (req, res) => {
    delete req.session;
    res.send();
});


router.post('/signup', async(req, res) => {
    if(req.body.password != req.body.password2) {
        res.json({error: 'Passwords do not match.'});
    } else {
        try {
            const user = new User(db);
            if(await user.userExists(req.body.username)) {
                res.json({error: 'This username is already in use.'});
            } else {
                const result = await user.signup(req.body.username, req.body.password);
                res.json(result);
            }
        } catch(e) {
            res.status(500).json({ error: e });
        }
    }
});

router.post('/login', 
    passport.authenticate('local'),
    (req, res, next) => {
		if(req.body.redirect) {
			req.session.save( (err) => {
				if(err) {
					res.status(500).json({error: err});
				} else {
					res.redirect(req.body.redirect);
				}
			});
		} else {
        	res.json(req.user);
		}
    }
);
        

router.get('/login', (req, res) => {
    try {
        const userDetails = req.user && req.user.userid ? req.user : {
            userid: 0,
            username: null,
            isadmin: 0
        };
        res.json(userDetails);
    } catch(e) {
        res.status(500).json(e);
    }
});

module.exports = router;
