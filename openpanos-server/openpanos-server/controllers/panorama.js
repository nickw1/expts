const db = require('../db');
const fs = require('fs');
const PanoModel = require('../models/panomodel');
const Photosphere = require('../models/photosphere');


class PanoController { 
    constructor(options = {}) {
        this.panoAuthCheck = options.panoAuthCheck || false;
    }

    async findById (req, res) {    
        try {
            const model = this.createModel(req);
            const row = await model.findById(req.params.id);    
            res.json(row); 
        } catch (e) {
            res.status(500).send(`Error finding panorama: ${e}`);
        }
    }

    async getPanoImg(req, res) {
        try {
            const model = this.createModel(req);
            const bytes = await model.getImage(req.params.id);
            res.set('content-type', 'image/jpeg').send(bytes);
        } catch(e) {
            res.status(e.status || 500).json({error: e.error || e});
        }
    }


    async findNearby (req,res) {
        try {
            const model = this.createModel(req);
            const results = await model.findNearby(req.params.id);
            res.json(results);
        } catch(e) {
            res.status(500).send(`Error finding nearby panos: ${e}`);
        }
    }

    async findNearest (req,res) {
        try {
            if (/^-?[\d\.]+$/.test(req.params.lon) && /^-?[\d\.]+$/.test(req.params.lat)) {
                const model = this.createModel(req);
                const results = await model.findNearest(req.params.lon, req.params.lat);
                res.json(results);
            } else {
                res.status(400).json([]);    
            }
        } catch(e) {
            res.status(500).send(`Error finding nearest pano: ${e}`);
        }
    }
   
    async getByBbox(req,res) {
        try {
            if(req.query.bbox !== undefined) {
                const bb = req.query.bbox.split(",").filter( value => /^-?[\d\.]+$/.test(value));
                if(bb.length == 4) {
                    const model = this.createModel(req);
                    const results = await model.getByBbox(bb);
                    res.json(results);
                }
            } else {
                res.status(400).json({"error": "Please supply a bbox."});
            }
        } catch(e) {
            res.status(500).send(`Error finding panos by bbox: ${e}`);
        }
    } 

    async getUnauthorised (req, res) {
        try {
            const model = this.createModel(req);
            const result = await model.getUnauthorised();
            res.json(result);
        } catch(e) {
            res.status(500).send(`Error finding unauthorised panos: ${e}`);
        }
    }
    
    async rotate(req,res) {
        try {
            const model = this.createModel(req);
            const data = await model.rotate(req.params.id, req.body.poseheadingdegrees);
            res.json(data);
        } catch(e) {
            res.status(e.status || 500).json({error: e.error || e});
        }
    }

   async move(req,res) {
        try {
            const model = this.createModel(req);
            const data = await model.move(req.params.id, req.body.lon, req.body.lat);
            res.json(data);
        } catch(e) {
            res.status(e.status || 500).json({error: e.error || e});
        }
    }

    async moveMulti(req,res) {
        try {
            const model = this.createModel(req);
            await res.json(model.moveMulti(req.body));
            res.send();
        } catch(e) {
            res.status(500).send(`Error moving multiple panos: ${e}`);
        }
    }

    async deletePano(req, res) {
        if(/^\d+$/.test(req.params.id)) {
            try {
                const model = this.createModel(req);
                await model.deletePano(req.params.id);
                res.send();
            } catch(e) {
                res.status(500).json({error: `Cannot delete panorama: details ${e}`});
            }
        } else {
            res.status(400).json({error: 'Pano ID must be numeric.'});
        }
    }

    async authorisePano(req, res) {
        if(/^\d+$/.test(req.params.id)) {
            try {
                const model = this.createModel(req);
                await model.authorisePano(req.params.id);
                res.send();
            } catch(e) {
                res.status(e.status || 500).json({error: e.error || e});
            }    
        } else {
            res.status(400).json({error: 'Pano ID must be numeric.'});
        }
    }

    async uploadPano(req,res) {
        let warnings = []; 
        const maxFileSize = 8;
        const model = this.createModel(req); 
        if (!req.files || !req.files.file) {
            res.status(400).json({"error": "No panorama provided."});
        } else {
            if(req.files.file.size > 1048576 * maxFileSize) {
                res.status(400).json({"error": `Exceeded file size of ${maxFileSize} MB.`});
            } else {
                const tmpName = req.files.file.tempFilePath;
                const photosphere = new Photosphere(tmpName);
                try {
                    const props = await photosphere.parseFile();
                    if(props.poseheadingdegrees === null) {
                        warnings.push( "No orientation found, you'll later need to orient this manually.");
                    } 
                        
                    let id = 0;
                    if(((props.lon !== null && props.lat !== null) || (req.body.lon !== undefined && req.body.lat !== undefined)) && /^-?[\d\.]+$/.test(props.lon) && /^-?[\d\.]+$/.test(props.lat)) {
                        const heading = props.poseheadingdegrees || 0;
                        const lat = req.body.lat || props.lat;
                        const lon = req.body.lon || props.lon;
                        const userid = req.user && req.user.userid ? req.user.userid: 0;
                        const geometry = `ST_GeomFromText('POINT(${lon} ${lat})', 4326)`;
                        const sql = (`INSERT INTO panoramas (the_geom, poseheadingdegrees, userid, timestamp, authorised) VALUES (${geometry}, ${heading}, ${userid}, ${new Date(props.time).getTime() / 1000}, 0) RETURNING id`);
                        const dbres = await db.query(sql);
                        id = dbres.rows[0].id;
                    } else {
                        let userid = 1;
                        const dbres = await db.query("INSERT INTO panoramas (the_geom, poseheadingdegrees, userid, timestamp, authorised) VALUES (NULL, 0, $1, 0)", [userid]);
                        warnings.push("No lat/lon information. You will need to manually position the panorama later.");
                        id = dbres.rows[0].id;
                    }
                    if(id > 0) {
                        req.files.file.mv(`${process.env.PANOS_DIR}/${id}.jpg`, async(err)=> {    
                            if(err) {
                                res.status(500).json({ "error": err });
                            }  else {
                                res.json({"success": true, "warnings": warnings});
                            }
                        });
                    }
                } catch (e) {
                    console.error(`parseFile() threw an error: ${JSON.stringify(e)}`);
                    res.status(400).json({"error": e});
                    fs.unlink(tmpName, (err)=> { console.error('unlink error')});
                }
            }
        }    
    }

    canViewUnauthorised(req, panodetails) {
        return !this.panoAuthCheck || (req.user && (req.user.isadmin == 1 || req.user.userid == panodetails.userid));
    }

    createModel(req) {
        return new PanoModel({ 
            db: db,
            canViewUnauthorised: this.canViewUnauthorised.bind(this, req)
        });
    }
}
    

module.exports = PanoController;
