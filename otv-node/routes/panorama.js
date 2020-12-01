const Router = require('express-promise-router');
const router = new Router();
const PanoModel = require('openpanos-server/models/panomodel');
const db = require('openpanos-server/db');
const sharp = require('sharp');
const validators = require('../util/validators');

router.get('/mine', async (req, res) => {
    try {
        if(req.user && req.user.userid) {
            const panoModel = new PanoModel({db: db});
            res.json(await panoModel.findByUser(req.user.userid));
        } else {
            res.status(401).json({"error": "Must be logged in to get your panos."});
        }
    } catch(e) {
        res.status(500).send(`Error finding current user's panos: ${e}`);
    }
});

router.get('/mine/unpositioned', async (req, res)=> {
    try {
        if(req.user && req.user.userid) {
            const panoModel = new PanoModel({db: db});
            res.json(await panoModel.findByUserUnpositioned(req.user.userid));
        } else {
            res.status(401).json({"error": "Must be logged in to get your panos."});
        }
    } catch(e) {
        res.status(500).send(`Error finding current user's unpositioned panos: ${e}`);
    }
});    

router.get('/:id(\\d+).w:width(\\d+).jpg', async (req, res) => {    
    try {
        const pano = new PanoModel({
                    db: db,
                    canViewUnauthorised: validators.canViewUnauthorised.bind
                        (validators, req)
                });
        const dbres = await pano.findById(req.params.id);
        const bytes = await pano.getImage(req.params.id);
        const resized = await sharp(bytes)
                        .resize(parseInt(req.params.width), null, {
                            withoutEnlargement: true
                        })
                        .toBuffer();
        res.set('Content-Type', 'image/jpg').send(resized);
    } catch(e) {
        res.json({error: e.error});
    }
});

module.exports = router;
