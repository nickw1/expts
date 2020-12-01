const express = require('express');
const bodyParser = require('body-parser');
const app = express();
require('dotenv').config();
const db = require('openpanos-server/db');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const fetch = require('node-fetch');

const op = require('openpanos-server');

const userRouter = require('./routes/user');
const mapRouter = require('./routes/map');
const osmRouter = require('./routes/osm');

const User = require('./models/user');

const morgan = require('morgan');

app.enable('trust proxy');

const panoRouter = require('./routes/panorama');

app.use(morgan('combined'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static('public'));
app.use(session({
    store: new pgSession({
        pool: db
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    unset: 'destroy',
    proxy: true,
    cookie: {
        maxAge: 600000,
        httpOnly: false
    }
}));

app.use((req, res, next) => {
    if(req.session.osmUser) {
        req.user = {
            userid: req.session.osmUser.userid,
            isadmin: 0,
            username: req.session.osmUser.displayName
        };
    }
    next();
});

const passport = require('passport');

app.use(passport.initialize());
app.use(passport.session());

app.set('view engine', 'pug');

passport.serializeUser((user, done) => {
    done(null, user.osm === true ? { userid: user.userid, username: user.username } : user.userid);
});

passport.deserializeUser(async (u, done) => {
    try {
        if(u.username !== undefined) {
            done(null, { userid: u.userid, username: u.username, isadmin: 0, osm: true });
        } else { 
            const user = new User(db);
            const details = await user.fromId(u);
            done(null, details);    
        }
    } catch(e) {
        done(e);
    }
});

const validators = require('./util/validators');
op.panoController.panoAuthCheck = true;

app.post(['/op/panorama/:id(\\d+)/rotate',
        '/op/panorama/:id(\\d+)/move'], validators.checkOwnerOrAdmin.bind(validators));

app.delete('/op/panorama/:id(\\d+)', validators.checkOwnerOrAdmin.bind(validators));

app.all(['/op/panorama/upload',
        '/addApp'], (req, res, next) => {
    if(req.user && req.user.userid) {
        next();
    } else {
        res.status(401).json({ error: 'You need to be logged in to perform this operation!'});
    }
});

app.post('/op/panorama/:id(\\d+)/authorise', validators.checkAdmin.bind(validators));
app.get('/op/panorama/unauthorised', validators.checkAdmin.bind(validators));

app.get('/nomproxy', async(req, res) => {
   const result = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${req.query.q}`, { 
            headers: { 
                'User-Agent': 'OpenTrailView (node.js)',
                'Referer': 'https://opentrailview.org'
            }
        })
        .then(response => response.json());
    res.json(result);
});

app.use('/map', mapRouter);
app.use('/op', op.router);
app.use('/user', userRouter);
app.use('/panorama', panoRouter);
app.use('/osm', osmRouter);
app.use('/oauth', require('./routes/oauth'));
app.use('/addApp', require('./routes/addapp'));

app.listen(3000);
