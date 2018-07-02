const config = require('../../accounts.config.json');
const EX = require('./index.js');
const wait = require('delay');

let ex = new EX({
	Key: config.bitflyer.key,
	Secret: config.bitflyer.secret,
	Currency: 'BTC',
	isWS: true,
	SnapshotMode: false,
	onDepth: (depth) => {
		// console.log('on depth');
		console.log('depth', depth);
	}
});


let log = console.log.bind(console);

describe('test Bitflyer', function() {

	this.timeout(10000);

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