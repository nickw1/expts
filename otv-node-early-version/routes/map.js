const Router = require('express-promise-router');
const router = new Router();

const db = require('openpanos-server/db');

router.get('/nearestHighway', async(req, res) => {
    if(/^-?[\d\.]+$/.test(req.query.lon) && /^-?[\d\.}+$/.test(req.query.lat) && /^[\d]+$/.test(req.query.dist)) {
        try {
            const lon = parseFloat(req.query.lon), lat = parseFloat(req.query.lat), dist = parseFloat(req.query.dist);
            const dbres = await db.query(`SELECT ST_AsText(ST_Transform(ST_ClosestPoint(way, transformed), 4326)) AS closest, highway, waydist FROM (SELECT *, ST_Distance(way, transformed) AS waydist FROM planet_osm_line, (SELECT ST_Transform(ST_GeomFromText('POINT(${lon} ${lat})', 4326), 3857) AS transformed) AS tquery WHERE way && ST_Transform(ST_SetSRID('BOX3D(${lon-0.01} ${lat-0.01},${lon+0.01} ${lat+0.01})'::box3d, 4326), 3857) ) AS dquery WHERE highway<>'' AND waydist < $1 ORDER BY waydist LIMIT 1`, [dist]);
            if(dbres.rows && dbres.rows.length == 1) {
                const m = dbres.rows[0].closest.match(/POINT\((-?[\d\.]+) (-?[\d\.]+)\)/);
                res.json({
                    lon: m[1],
                    lat: m[2],
                    highway: dbres.rows[0].highway,
                    waydist: dbres.rows[0].waydist
                });
        
            } else {
                res.json({});
            }
        } catch(e) {
            res.status(500).json({error: e});
        }
    } else {
        res.status(400).json({"error": "Invalid input parameter format"});
    }
});

module.exports = router;
