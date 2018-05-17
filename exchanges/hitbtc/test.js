const config = require('../../accounts.config.json');
const EX = require('./index.js');
const wait = require('pwait');

let ex = new EX({
	Key: config.hitbtc.key,
	Secret: config.hitbtc.secret,
	Currency: 'BTC',
	isWS: true,
	onDepth: (depth)=>{
		console.log(depth);
	}
});


let log = console.log.bind(console);
let orderId = '';

describe('test HitBTC', function() {

	this.timeout(10000);

	// it('should get ticker', ()=>ex.GetTicker().then(log));

	// it('should get depth', ()=>ex.GetDepth().then(log));

	// it('should get account', ()=>ex.GetAccount().then(log));

	// it('should get pending orders', ()=>ex.GetOrders().then(orders=>{
	// 	if (orders && orders.length > 0) {
	// 		orderId = orders[0].Id;
	// 	}
	// 	return orders;
	// }).then(log));

	// it('should get order', ()=>{
	// 	if (orderId) {
	// 		return ex.GetOrder(orderId).then(log);
	// 	} else {
	// 		return Promise.resolve(1);
	// 	}
	// });

	// it('should get account', ()=>ex.GetAccount().then(log));

	// it('should buy at very low price', async ()=>{
	// 	orderId = await ex.Buy(5000, 0.01);
	// 	log(orderId);
	// });

	// it('should buy market', async ()=>{
	// 	orderId = await ex.Buy(-1, 0.01);
	// 	log(orderId);
	// });

	// it('should sell at very high price', async ()=>{
	// 	orderId = await ex.Sell(6000, 0.01);
	// 	log(orderId);
	// });

	// it('should get account', ()=>ex.GetAccount().then(log));

	// it('should get order', () => {
	// 	return ex.GetOrder(orderId).then(log);
	// });

	// it('should cancel order', async ()=>{
	// 	let result = await ex.CancelOrder(orderId);
	// 	console.log(result, typeof result);
	// });
	// it('should get account', ()=>ex.GetAccount().then(log));

	// it('should cancel all orders', ()=>{
	// 	return ex.CancelPendingOrders().then(log);
	// });

	// it('should sell market', ()=>{
	// 	return ex.Sell(-1, 0.01).then(log);
	// });
	// it('should get account', ()=>ex.GetAccount().then(log));


	it('should wait for a long time', function(){
		this.timeout(1000000000);
		return wait(1000000000);
	});
	
	

	
});