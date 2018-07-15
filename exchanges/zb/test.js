const { ZB } = require('../../index.js');
const config = require('../../accounts.config.json');
const assert = require('better-assert');
const debug = require('debug')('log');

// require('./nock.js');
const wait = require('delay');
const moment = require('moment');

let ex = new ZB({
	Currency: 'USDT',
	BaseCurrency: 'QC',
	Key: config.zb.key,
	Secret: config.zb.secret,
	isWS: false 
});

let ids = {}, stocks = 0, balance = 0, lastPrice = 0;

describe('test zb', function() {
	this.timeout(10000000);

	it('should wait until websocket ready', () => {
		return ex.waitUntilWSReady();
	});

	it('should get ticker', async () => {
		let t = await ex.GetTicker();
		debug(t);
		assert(t);
		assert(t.Last && t.Buy && t.Sell && t.Time && t.High && t.Low);
		assert(t.Currency === 'USDT');
		assert(t.BaseCurrency === 'QC');

		t = await ex.GetTicker('EOS', 'USDT');
		debug(t);
		assert(t.Last && t.Buy && t.Sell && t.Time && t.High && t.Low);
		assert(t.Currency === 'EOS');
		assert(t.BaseCurrency === 'USDT');
	});

	it('should get depth', async () => {
		let t = await ex.GetDepth();
		debug(t);
		assert(t);
		assert(t.Asks && t.Bids);
		assert(t.Asks.length > 0 && t.Bids.length > 0);
		assert(t.Asks[0].Price > 0 && t.Asks[0].Amount > 0);
		assert(t.Bids[0].Price > 0 && t.Bids[0].Amount > 0);
		assert(t.Currency === 'USDT');
		assert(t.BaseCurrency === 'QC');

		t = await ex.GetDepth('EOS', 'USDT');
		debug(t);
		assert(t.Asks && t.Bids);
		assert(t.Currency === 'EOS');
		assert(t.BaseCurrency === 'USDT');
	});

	it('should get records', async () => {
		let data = await ex.GetRecords();
		data = data.map(d => {
			d.Date = new Date(d.Time);
			return d;
		});
		console.log(data);
	});

	// it('should get account', async () => {
	// 	let t = await ex.GetAccount();
	// 	debug(t);
	// 	assert(t);
	// 	assert(Object.keys(t).indexOf('Stocks') > -1);
	// 	assert(Object.keys(t).indexOf('FrozenStocks') > -1);
	// 	assert(Object.keys(t).indexOf('Balance') > -1);
	// 	assert(Object.keys(t).indexOf('FrozenBalance') > -1);
	// 	assert(t.Currency === 'USDT');
	// 	assert(t.BaseCurrency === 'QC');

	// 	let t2 = await ex.GetAccount('BTC', 'USDT');
	// 	debug(t2);
	// 	assert(t2.Currency === 'BTC');
	// 	assert(t2.BaseCurrency === 'USDT');
	// });

	// it('should get accounts', async () => {
	// 	let a = await ex.GetAccounts();
	// 	debug(a);
	// 	assert(a);
	// 	assert(a[0]);
	// 	assert(a[0].Currency);
	// 	assert(Object.keys(a[0]).indexOf('Free') > -1);
	// 	assert(Object.keys(a[0]).indexOf('Frozen') > -1);
	// });


	

	// it('should buy', async () => {
	// 	let orderId = await ex.Buy(1, 1, 'ZB', 'QC');
	// 	debug(orderId);
	// 	assert(orderId);
	// 	let orderInfo = await ex.GetOrder(orderId, 'ZB', 'QC');
	// 	debug(orderInfo);
	// 	assert(orderInfo);
	// 	assert(orderInfo.Id);
	// 	assert(orderInfo.Price === 1);
	// 	assert(orderInfo.Amount === 1);
	// 	assert(orderInfo.DealAmount === 0);
	// 	assert(orderInfo.Type === 'Buy');
	// 	assert(orderInfo.Time);
	// 	assert(orderInfo.Status === 'Pending');
	// 	assert(orderInfo.Currency === 'ZB');
	// 	assert(orderInfo.BaseCurrency === 'QC');
	// });

	// it('should sell', async () => {
	// 	let orderId = await ex.Sell(8, 1);
	// 	debug(orderId);
	// 	assert(orderId);
	// 	let orderInfo = await ex.GetOrder(orderId);
	// 	debug(orderInfo);
	// 	assert(orderInfo);
	// 	assert(orderInfo.Id);
	// 	assert(orderInfo.Price === 8);
	// 	assert(orderInfo.Amount === 1);
	// 	assert(orderInfo.DealAmount === 0);
	// 	assert(orderInfo.Type === 'Sell');
	// 	assert(orderInfo.Time);
	// 	assert(orderInfo.Status === 'Pending');
	// 	assert(orderInfo.Currency === 'USDT');
	// 	assert(orderInfo.BaseCurrency === 'QC');
	// });

	// it('should get orders', async () => {
	// 	let pendingOrders = await ex.GetOrders();
	// 	debug(pendingOrders);
	// 	assert(pendingOrders);
	// 	assert(pendingOrders[0]);
	// 	let orderInfo = pendingOrders[0];
	// 	assert(orderInfo.Id);
	// 	assert(orderInfo.Price === 8);
	// 	assert(orderInfo.Amount === 1);
	// 	assert(orderInfo.DealAmount === 0);
	// 	assert(orderInfo.Type === 'Sell');
	// 	assert(orderInfo.Time);
	// 	assert(orderInfo.Status === 'Pending');
	// 	assert(orderInfo.Currency === 'USDT');
	// 	assert(orderInfo.BaseCurrency === 'QC');
	// });

	// it('should cancel buy order', async () => {
	// 	let a = await ex.GetOrders('ZB', 'QC');
	// 	debug(a);
	// 	assert(a.length > 0);

	// 	let re = await ex.CancelOrder(a[0].Id, 'ZB', 'QC');
	// 	debug(re);

	// 	// let re2 = await ex.CancelPendingOrders('ZB', 'QC');
	// 	// debug(re2);

	// 	let a2 = await ex.GetOrders('ZB', 'QC');
	// 	debug(a2);
	// 	assert(a2.length === 0);
	// });

	

	// it('should cancel all pending orders', async () => {
	// 	let a = await ex.GetOrders();
	// 	debug(a);
	// 	assert(a.length > 0);

	// 	let re = await ex.CancelPendingOrders();
	// 	debug(re);

	// 	let a2 = await ex.GetOrders();
	// 	debug(a2);
	// 	assert(a2.length === 0);
	// });


	

	// it('should get trades', async () => {
	// 	let t = 0;
	// 	while ( t < 10 ) {
	// 		try {
	// 			let arr = await ex.GetTrades('BTC', 'QC');
	// 			arr = arr.filter(o => {
	// 				return !ids[o.Id];
	// 			});

	// 			arr = arr.map(o => {
	// 				ids[o.Id] = true;
	// 				delete o.Info;
	// 				o.Time = moment(o.Time).format('YYYY-MM-DD HH:mm:ss:SSS');
	// 				return o;
	// 			});

	// 			arr.map(o => {
	// 				if (o.Type === 'Buy') {
	// 					balance -= o.DealAmount * o.AvgPrice;
	// 					stocks += o.DealAmount;
	// 				} else {
	// 					balance += o.DealAmount * o.AvgPrice;
	// 					stocks -= o.DealAmount;
	// 				}
	// 				lastPrice = o.AvgPrice;
	// 			});

	// 			console.log(arr);

	// 			let value = stocks * lastPrice + balance;
	// 			console.log(`stocks = ${stocks} balance = ${balance} value = ${value}`);
	// 		} catch (err) {
	// 			console.error(err);
	// 		}
	// 		await wait(1000);
	// 		t++;
	// 	}
	// });


});