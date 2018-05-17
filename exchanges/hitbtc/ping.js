const config = require('../../accounts.config.json');
const EX = require('./index.js');
const wait = require('pwait');

let ex = new EX({
	Key: config.hitbtc.key,
	Secret: config.hitbtc.secret,
	Currency: 'BTC',
	isWS: true,
	onDepth: (depth)=>{
		//console.log(depth);
	},
	onPong: (t) => {
		console.log('pong', t+'ms');
	}
});

