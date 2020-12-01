const fetch = require('node-fetch');
f();
async function f() {
	const data = await fetch(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/13/4079/2740.jpg`)
		.then (res => res.arrayBuffer());
	console.log(new Uint8Array(data));
	//res.set('content-type', 'image/png').send(data);
//	res.set('content-type', 'text/plain').send(data);
}
