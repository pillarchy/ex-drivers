const config = require('../../accounts.config.json');
const { BITMEX: EX } = require('../../index.js');
const wait = require('delay');

let ex = new EX({
	Key: config.bitmex.key,
	Secret: config.bitmex.secret,
	Currency: 'XBT',
	isWS: true,
	RateLimit: 2,
	RateLimitInterval: 1000,
	// ThrowWhenRateLimited: true,
	onDepth: (depth) => {
		console.log(depth);
		// console.log('depth', depth.Asks.length, depth.Bids.length, depth.Asks[0].Price, depth.Bids[0].Price);
	}
});


let log = console.log.bind(console);

describe('test Bitflyer', function() {

	this.timeout(10000);

	// it('should get ticker', () => ex.GetTicker().then(log));
	// it('should get ticker', () => ex.GetTicker().then(log));

	// it('should get depth', () => ex.GetDepth().then(log));
	// 
	

	// it('should get order', () => ex.GetOrder('JRF20180620-183753-349466').then(log));

	// it('should get account', () => ex.GetAccount().then(log));

	// it('should get position', () => ex.GetNetPosition().then(log));

	// it('should get collateral', () => ex.GetCollateral().then(log));

	// it('should get orders', async () => {
	// 	let orders = await ex.GetOrders();
	// 	console.log(orders);
	// 	if (orders.length > 0) {
	// 		console.log(await ex.GetOrder(orders[0].Id));
	// 	}
	// });

	// it('should short', async () => {
	// 	try {
	// 		let orderId = await ex.Short(770712, 0.01);
	// 		console.log('short result', orderId);

	// 		await wait(1000);
	// 		console.log(await ex.GetOrder(orderId));
	// 	} catch (err) {
	// 		console.log(err.code, err.message);
	// 	}

	// 	// console.log(await ex.CancelOrder(orderId));
	// });

	// it('should get account', () => ex.GetAccount().then(log));
	
	// it('should cancel pending orders', async () => {
	// 	console.log(await ex.CancelPendingOrders());
	// });

	it('should wait for a long time', function() {
		this.timeout(1000000000);
		return wait(1000000000);
	});
});