const Router = require('express-promise-router');
const fetch = require('node-fetch');

const router = new Router();

router.get('/', async (req, res) => {
	const data = await fetch(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${req.query.z}/${req.query.x}/${req.query.y}.png`)
		.then(resp => {
			resp.body.pipe(res);
		});
});


module.exports = router;
