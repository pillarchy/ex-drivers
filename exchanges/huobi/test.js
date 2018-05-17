const path = require('path');

global.testing = true;
global.chai = require('chai');
global.expect = chai.expect;

const wait = require('pwait');

const assert = require('assert');

let config = require('../../accounts.config.json');
const N = require('precise-number');

const RateLimiter = require('../../lib/rate-limit');
const rateLimiter = new RateLimiter(1000, 10);

const EX = require('./index.js');
const Exchange = new EX({
	Key: config.hb_30off_long_billcn.key,
	Secret: config.hb_30off_long_billcn.secret,
	Currency: 'EOS',
	BaseCurrency: 'ETH',
	rateLimiter,
	Decimals: 8,
	StockDecimals: 4
});



const log = console.log.bind(console);

describe('test huobipro rest api', function() {

	this.timeout(10000000);


	let Ticker = null;
	it('should get ticker', () => Exchange.GetTicker().then(log));

	// it('should get depth', () => Exchange.GetDepth('step1').then(log));

	// it('should get account info', () => Exchange.GetAccount().then(log));

	// it('should get ticker', () => Exchange.GetTicker().then(log));

	// it('should get depth', () => Exchange.GetDepth('step1').then(log));

	it('should get account info', () => Exchange.GetAccount('point').then(a => {
		console.log(JSON.stringify(a, null, "\t"));
	}));


	// it('should get pending orders', ()=>{
	// 	return Exchange.GetOrders().then(a=>{
	// 		console.log(a);
	// 	});
	// });

	// it('cancel fake order ', () => {
	// 	return Exchange.CancelOrder(1234567).then(a=>{
	// 		setTimeout(()=>{
	// 			throw new Error('this should throw an error. but it didnt');
	// 		});
	// 	}).catch(err=>{
	// 		log(err);
	// 	});
	// });

	// it('get fake order ', () => {
	// 	return Exchange.GetOrder(1234567).then(a=>{
	// 		throw new Error('this should throw an error. but it didnt');
	// 	}).catch(err=>{
	// 		log(err);
	// 	});
	// });

	// it('cancel pending orders ', ()=>{
	// 	if (pendingOrders && pendingOrders.length > 0) {
	// 		let o = pendingOrders.shift();
	// 		console.log('cancelling order ',o.Id);
	// 		return Exchange.CancelOrder(o.Id).then(a=>{
	// 			expect(a).to.be.true;
	// 		});
	// 	} else {
	// 		console.log('no pending orders');
	// 		return Promise.resolve(1);
	// 	}
	// });

	let orderId = null;

	// it('should buy', ()=>{
	// 	return Exchange.Buy(0.01138454, 0.1).then(i=>{
	// 		console.log('orderId=', i);
	// 		orderId = i;
	// 	});
	// });

	// it('get order info', ()=>{
	// 	if (orderId) {
	// 		return Exchange.GetOrder(orderId).then(log);
	// 	} else {
	// 		return Promise.resolve(1);
	// 	}
	// });

	// let account = null;
	// it('get account info again', () => {
	// 	return Exchange.GetAccount().then(a=>{
	// 		console.log(a);
	// 	});
	// });

	// let sellOrderId = null;
	// it('should sell at 20000', () => {
	// 	return Exchange.Sell(0.011, 0.1).then(orderId => {
	// 		console.log(orderId);
	// 		sellOrderId = orderId;
	// 	});
	// });

	// it('get order info', () => {
	// 	if (sellOrderId) {
	// 		return Exchange.GetOrder(sellOrderId).then(o=>{
	// 			console.log(o);
	// 		});
	// 	} else {
	// 		return Promise.resolve(1);
	// 	}
	// });

	// it('cancel sell order ', () => {
	// 	if (sellOrderId) {
	// 		return Exchange.CancelOrder(sellOrderId).then(a=>{
	// 			console.log(a);
	// 		});
	// 	} else {
	// 		return Promise.resolve(1);
	// 	}
	// });

	// it('get order info', () => {
	// 	if (sellOrderId) {
	// 		return Exchange.GetOrder(sellOrderId).then(o=>{
	// 			console.log(o);
	// 		});
	// 	} else {
	// 		return Promise.resolve(1);
	// 	}
	// });

	// it('should sell', ()=>Exchange.Sell(0.044, 0.01));

	// it('should sell', done=>{
	// 	Exchange.Sell(0.046, 0.01).then(orderId=>{
	// 		done();
	// 	}).catch(err=>setTimeout(()=>{throw err}));
	// });

	// it('should sell', done=>{
	// 	Exchange.Sell(0.05, 0.01).then(orderId=>{
	// 		done();
	// 	}).catch(err=>setTimeout(()=>{throw err}));
	// });

	// it('should buy', done=>{
	// 	Exchange.Buy(0.04, 0.01).then(orderId=>{
	// 		done();
	// 	}).catch(err=>setTimeout(()=>{throw err}));
	// });

	// it('cancel all pending orders', () => {
	// 	return Exchange.CancelPendingOrders().then(a => {
	// 		console.log(a);
	// 	});
	// });

	// it('get account info again', done=>{
	// 	Exchange.GetAccount().then(a=>{
	// 		console.log(a);
	// 		expect(a.Balance>0).to.be.true;
	// 		expect(a.Stocks>=0).to.be.true;
	// 		done();
	// 	}).catch(err=>setTimeout(()=>{throw err}));
	// });

});
