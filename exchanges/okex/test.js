const { OKEX: EX } = require('../../index.js');
const config = require('../../accounts.config.json');
const assert = require('better-assert');
const debug = require('debug')('log');

const wait = require('delay');
const moment = require('moment');

let ex = new EX({
	Currency: 'ETC',
	BaseCurrency: 'USDT',
	Key: config.ok01.key,
	Secret: config.ok01.secret,
	isWS: false 
});

let ids = {}, stocks = 0, balance = 0, lastPrice = 0;

describe('test zb', function() {
	this.timeout(10000000);

	it('should wait until websocket ready', () => {
		return ex.waitUntilWSReady();
	});

	it('should get markets', async () => {
		let markets = await ex.GetMarkets();
		markets.map(m => {
			console.log(m.Currency + '_' + m.BaseCurrency, m.Decimals, m.StockDecimals, m.MinTradeAmount);
		});
	});

	it('should get MarketsMap', async () => {
		console.log(await ex.GetMarketsMap());
	});

	it('should get market info', async () => {
		console.log(await ex.GetMarket('BTC', 'USDT'));
		console.log(await ex.GetMarket('ETH', 'BTC'));
	});

	// it('should get public trades', async () => {
	// 	console.log(await ex.GetPublicTrades());
	// 	console.log(await ex.GetPublicTrades('BTC'));
	// });

	// it('should get ticker', async () => {
	// 	let t = await ex.GetTicker();
	// 	debug(t);
	// 	assert(t);
	// 	assert(t.Last && t.Buy && t.Sell && t.Time && t.High && t.Low);
	// 	assert(t.Currency === 'ETC');
	// 	assert(t.BaseCurrency === 'USDT');

	// 	t = await ex.GetTicker('EOS', 'USDT');
	// 	debug(t);
	// 	assert(t.Last && t.Buy && t.Sell && t.Time && t.High && t.Low);
	// 	assert(t.Currency === 'EOS');
	// 	assert(t.BaseCurrency === 'USDT');
	// });

	// it('should get depth', async () => {
	// 	let t = await ex.GetDepth();
	// 	debug(t);
	// 	assert(t);
	// 	assert(t.Asks && t.Bids);
	// 	assert(t.Asks.length > 0 && t.Bids.length > 0);
	// 	assert(t.Asks[0].Price > 0 && t.Asks[0].Amount > 0);
	// 	assert(t.Bids[0].Price > 0 && t.Bids[0].Amount > 0);
	// 	assert(t.Currency === 'ETC');
	// 	assert(t.BaseCurrency === 'USDT');

	// 	t = await ex.GetDepth('EOS', 'BTC');
	// 	debug(t);
	// 	assert(t.Asks && t.Bids);
	// 	assert(t.Currency === 'EOS');
	// 	assert(t.BaseCurrency === 'BTC');
	// });

	// it('should get account', async () => {
	// 	let t = await ex.GetAccount();
	// 	debug(t);
	// 	assert(t);
	// 	assert(Object.keys(t).indexOf('Stocks') > -1);
	// 	assert(Object.keys(t).indexOf('FrozenStocks') > -1);
	// 	assert(Object.keys(t).indexOf('Balance') > -1);
	// 	assert(Object.keys(t).indexOf('FrozenBalance') > -1);
	// 	assert(t.Currency === 'ETC');
	// 	assert(t.BaseCurrency === 'USDT');

	// 	let t2 = await ex.GetAccount('EOS', 'USDT');
	// 	debug(t2);
	// 	assert(t2.Currency === 'EOS');
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
	// 	let orderId = await ex.Buy(15, 0.01);
	// 	debug(orderId);
	// 	assert(orderId);
	// 	await wait(3000);
	// 	let orderInfo = await ex.GetOrder(orderId);
	// 	debug(orderInfo);
	// 	assert(orderInfo);
	// 	assert(orderInfo.Id);
	// 	assert(orderInfo.Price === 15);
	// 	assert(orderInfo.Amount === 0.01);
	// 	assert(orderInfo.DealAmount === 0);
	// 	assert(orderInfo.Type === 'Buy');
	// 	assert(orderInfo.Time);
	// 	assert(orderInfo.Status === 'Pending');
	// 	assert(orderInfo.Currency === 'ETC');
	// 	assert(orderInfo.BaseCurrency === 'USDT');
	// });

	// it('should buy', async () => {
	// 	let orderId = await ex.Buy(0.1, 0.01, 'BCH', 'BTC');
	// 	debug(orderId);
	// 	assert(orderId);
	// 	await wait(3000);
	// 	let orderInfo = await ex.GetOrder(orderId, 'BCH', 'BTC');
	// 	debug(orderInfo);
	// 	assert(orderInfo);
	// 	assert(orderInfo.Id);
	// 	assert(orderInfo.Price === 0.1);
	// 	assert(orderInfo.Amount === 0.01);
	// 	assert(orderInfo.DealAmount === 0);
	// 	assert(orderInfo.Type === 'Buy');
	// 	assert(orderInfo.Time);
	// 	assert(orderInfo.Status === 'Pending');
	// 	assert(orderInfo.Currency === 'BCH');
	// 	assert(orderInfo.BaseCurrency === 'BTC');
	// });


	// it('should get orders', async () => {
	// 	let pendingOrders = await ex.GetOrders();
	// 	debug(pendingOrders);
	// 	assert(pendingOrders);
	// 	assert(pendingOrders[0]);
	// 	let orderInfo = pendingOrders[0];
	// 	assert(orderInfo.Id);
	// 	assert(orderInfo.Price === 15);
	// 	assert(orderInfo.Amount === 0.01);
	// 	assert(orderInfo.DealAmount === 0);
	// 	assert(orderInfo.Type === 'Buy');
	// 	assert(orderInfo.Time);
	// 	assert(orderInfo.Status === 'Pending');
	// 	assert(orderInfo.Currency === 'ETC');
	// 	assert(orderInfo.BaseCurrency === 'USDT');
	// });

	// it('should cancel buy order', async () => {
	// 	let a = await ex.GetOrders('BCH', 'BTC');
	// 	debug(a);
	// 	assert(a.length > 0);

	// 	// let re = await ex.CancelOrder(a[0].Id, 'BCH', 'BTC');
	// 	// debug(re);

	// 	let re2 = await ex.CancelPendingOrders('BCH', 'BTC');
	// 	debug(re2);
	// 	await wait(2000);
	// 	let a2 = await ex.GetOrders('BCH', 'BTC');
	// 	debug(a2);
	// 	assert(a2.length === 0);
	// });

	

	// it('should cancel all pending orders', async () => {
	// 	let a = await ex.GetOrders();
	// 	debug(a);
	// 	assert(a.length > 0);

	// 	let re = await ex.CancelPendingOrders();
	// 	debug(re);

	// 	await wait(1000);

	// 	let a2 = await ex.GetOrders();
	// 	debug(a2);
	// 	assert(a2.length === 0);
	// });


	

	// it('should get trades', async () => {
	// 	let t = 0;
	// 	while ( t < 100 ) {
	// 		try {
	// 			let arr = await ex.GetTrades('BTC', 'USDT');
	// 			arr = arr.filter(o => {
	// 				return !ids[o.Id];
	// 			});

	// 			arr = arr.map(o => {
	// 				ids[o.Id] = true;
	// 				// delete o.Info;
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