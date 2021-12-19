const db = require('openpanos-server/db');
const PanoModel = require('openpanos-server/models/panomodel');

module.exports = {
    checkOwnerOrAdmin: async function(req, res, next) {
        try {
            const pano = new PanoModel({db: db});
            const dbres = await pano.findById(req.params.id);
            if(this.canViewUnauthorised(req, dbres)) {
                next();
            } else {
                res.status(401).json({ error: 'Only panorama owners or administrators can manipulate.'});
            }
        } catch(e) { 
            res.status(500).json({ error: e });
        }
    },

    checkAdmin: async function (req, res, next) {
        //if (req.session && req.session.isadmin == 1) {
        if (req.user && req.user.isadmin == 1) {
            await next();
        } else {
            res.status(401).json({"error": "Only administrators can perform this operation."});
        }
    },

    canViewUnauthorised: function(req, panodetails) {
        //return req.session && (req.session.isadmin == 1 || req.session.userid == panodetails.userid);
		const userObj = req.oauthInfo || req.user;
        return userObj && (userObj.isadmin == 1 || userObj.userid == panodetails.userid);
    }
};
