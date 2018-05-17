const config = require('../../accounts.config.json');
const EX = require('./index.js');
const wait = require('pwait');

let ex = new EX({
	Key: config.bitflyer.key,
	Secret: config.bitflyer.secret,
	Currency: 'BTC',
	Rate: 1,
	isWS: false,
	onDepth: (depth) => {
		console.log(depth);
	}
});


let log = console.log.bind(console);

describe('test Bitflyer', function() {

	this.timeout(10000);

	it('should get ticker', () => ex.GetTicker().then(log));

	it('should get depth', () => ex.GetDepth().then(log));

	it('should get account', () => ex.GetAccount().then(log));

	it('should get position', () => ex.GetPosition().then(log));

	// // it('should get collateral', ()=>ex.GetCollateral().then(log));

	// it('should get orders', () => {
	// 	return ex.GetOrders().then(log);
	// });
	
	it('should wait for a long time', function() {
		this.timeout(1000000000);
		return wait(1000000000);
	});
});