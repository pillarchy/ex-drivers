const { HUOBI } = require('../../index.js');
const config = require('../../accounts.config.json');
const assert = require('better-assert');
const debug = require('debug')('log');

// require('./nock.js');
const wait = require('delay');
const moment = require('moment');

let ex = new HUOBI({
	Currency: 'QTUM',
	BaseCurrency: 'USDT',
	Key: config.huobi.key,
	Secret: config.huobi.secret,
	isWS: false 
});

let ids = {}, stocks = 0, balance = 0, lastPrice = 0;

describe('test huobi', function() {
	this.timeout(10000000);

	it('should wait until websocket ready', () => {
		return ex.waitUntilWSReady();
	});

	it('should get ticker', async () => {
		let t = await ex.GetTicker();
		debug(t);
		assert(t);
		assert(t.Last && t.Buy && t.Sell && t.Time && t.High && t.Low);
		assert(t.Currency === 'QTUM');
		assert(t.BaseCurrency === 'USDT');
	});

	it('should get ticker 2', async () => {
		let t = await ex.GetTicker('EOS', 'USDT');
		debug(t);
		assert(t);
		assert(t.Last && t.Buy && t.Sell && t.Time && t.High && t.Low);
		assert(t.Currency === 'EOS');
		assert(t.BaseCurrency === 'USDT');
	});

	it('should get ticker 3', async () => {
		let t = await ex.GetTicker('ETH', 'BTC');
		debug(t);
		assert(t);
		assert(t.Last && t.Buy && t.Sell && t.Time && t.High && t.Low);
		assert(t.Currency === 'ETH');
		assert(t.BaseCurrency === 'BTC');
	});

	it('should get depth', async () => {
		let t = await ex.GetDepth();
		debug(t);
		assert(t);
		assert(t.Asks && t.Bids);
		assert(t.Asks.length > 0 && t.Bids.length > 0);
		assert(t.Asks[0].Price > 0 && t.Asks[0].Amount > 0);
		assert(t.Bids[0].Price > 0 && t.Bids[0].Amount > 0);
		assert(t.Currency === 'QTUM');
		assert(t.BaseCurrency === 'USDT');
	});

	it('should get depth 2', async () => {
		let t = await ex.GetDepth('EOS', 'BTC');
		debug(t);
		assert(t);
		assert(t.Asks && t.Bids);
		assert(t.Asks.length > 0 && t.Bids.length > 0);
		assert(t.Asks[0].Price > 0 && t.Asks[0].Amount > 0);
		assert(t.Bids[0].Price > 0 && t.Bids[0].Amount > 0);
		assert(t.Currency === 'EOS');
		assert(t.BaseCurrency === 'BTC');
	});

	it('should get account', async () => {
		let t = await ex.GetAccount();
		debug(t);
		assert(t);
		assert(Object.keys(t).indexOf('Stocks') > -1);
		assert(Object.keys(t).indexOf('FrozenStocks') > -1);
		assert(Object.keys(t).indexOf('Balance') > -1);
		assert(Object.keys(t).indexOf('FrozenBalance') > -1);
		assert(t.Currency === 'QTUM');
		assert(t.BaseCurrency === 'USDT');
	});

	it('should get account 2', async () => {
		let t = await ex.GetAccount('EOS', 'BTC');
		debug(t);
		assert(t);
		assert(Object.keys(t).indexOf('Stocks') > -1);
		assert(Object.keys(t).indexOf('FrozenStocks') > -1);
		assert(Object.keys(t).indexOf('Balance') > -1);
		assert(Object.keys(t).indexOf('FrozenBalance') > -1);
		assert(t.Currency === 'EOS');
		assert(t.BaseCurrency === 'BTC');
	});

	it('should get accounts', async () => {
		let a = await ex.GetAccounts();
		debug(a);
		assert(a);
		assert(a[0]);
		assert(a[0].Currency);
		assert(Object.keys(a[0]).indexOf('Free') > -1);
		assert(Object.keys(a[0]).indexOf('Frozen') > -1);
	});

	it('should get accounts map', async () => {
		let a = await ex.GetAccountsMap();
		debug(a);
		assert(a);
		assert(a.BTC);
		assert(a.USDT.Free);
	});
	

	it('should buy', async () => {

		let orderId = await ex.Buy(400, 0.01, 'ETH', 'USDT');
		debug(orderId);
		assert(orderId);
		let orderInfo = await ex.GetOrder(orderId, 'ETH', 'USDT');
		debug(orderInfo);
		assert(orderInfo);
		assert(orderInfo.Id);
		assert(orderInfo.Price === 400);
		assert(orderInfo.Amount === 0.01);
		assert(orderInfo.DealAmount === 0);
		assert(orderInfo.Type === 'Buy');
		assert(orderInfo.Time);
		assert(orderInfo.Status === 'Pending');
		assert(orderInfo.Currency === 'ETH');
		assert(orderInfo.BaseCurrency === 'USDT');
	});

	it('should sell', async () => {
		let orderId = await ex.Sell(700, 0.01, 'ETH', 'USDT');
		debug(orderId);
		assert(orderId);
		let orderInfo = await ex.GetOrder(orderId, 'ETH', 'USDT');
		debug(orderInfo);
		assert(orderInfo);
		assert(orderInfo.Id);
		assert(orderInfo.Price === 700);
		assert(orderInfo.Amount === 0.01);
		assert(orderInfo.DealAmount === 0);
		assert(orderInfo.Type === 'Sell');
		assert(orderInfo.Time);
		assert(orderInfo.Status === 'Pending');
		assert(orderInfo.Currency === 'ETH');
		assert(orderInfo.BaseCurrency === 'USDT');
	});

	it('should get orders', async () => {
		let pendingOrders = await ex.GetOrders('ETH', 'USDT');
		debug(pendingOrders);
		assert(pendingOrders);
		assert(pendingOrders[0]);
		let orderInfo = pendingOrders[0];
		assert(orderInfo.Id);
		assert(orderInfo.Price === 700);
		assert(orderInfo.Amount === 0.01);
		assert(orderInfo.DealAmount === 0);
		assert(orderInfo.Type === 'Sell');
		assert(orderInfo.Time);
		assert(orderInfo.Status === 'Pending');
		assert(orderInfo.Currency === 'ETH');
		assert(orderInfo.BaseCurrency === 'USDT');
	});

	it('should cancel buy order', async () => {
		let a = await ex.GetOrders('ETH', 'USDT');
		debug(a);
		assert(a.length > 0);

		let re = await ex.CancelOrder(a[0].Id, 'ETH', 'USDT');
		debug(re);
		console.log(re);
		console.log(await ex.GetOrder(a[0].Id, 'ETH', 'USDT'));

		await wait(20000);

		console.log(await ex.GetOrder(a[0].Id, 'ETH', 'USDT'));

		let a2 = await ex.GetOrders('ETH', 'USDT');
		debug(a2);
		assert(a2.length === 1);
	});

	

	it('should cancel all pending orders', async () => {
		let a = await ex.GetOrders('ETH', 'USDT');
		debug(a);
		assert(a.length > 0);

		let re = await ex.CancelPendingOrders('ETH', 'USDT');
		debug(re);

		await wait(20000);

		let a2 = await ex.GetOrders('ETH', 'USDT');
		debug(a2);
		assert(a2.length === 0);
	});


	

	// it('should get trades', async () => {
	// 	let t = 0;
	// 	while ( t < 100 ) {
	// 		try {
	// 			let arr = await ex.GetTrades('ETH', 'USDT');
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