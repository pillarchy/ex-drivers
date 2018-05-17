const path = require('path');
const expect = require('chai').expect;

const assert = require('assert');

let config = require('../../accounts.config.json');
const N = require('precise-number');
const delay = require('delay');

const Bithumb = require('./index.js');
const Exchange = new Bithumb({
	Key: config.bithumb.key,
	Secret: config.bithumb.secret,
	Currency: 'BTC',
	isWS: false,
	onDepth: (data) => {
		console.log(data);
	}
});

const log = console.log.bind(console);

describe('test bithumb rest api', function() {
	this.timeout(1000000000);

	// it('should wait', delay(1000000000));

	// let Ticker = null;
	// it('should get ticker', ()=>Exchange.GetTicker().then(t => {
	// 	log(t);
	// 	expect(t).to.be.an('object');
	// 	expect(t.Sell > t.Buy).to.equal(true);
	// }));

	// it('should get depth', ()=>Exchange.GetDepth().then(log));

	// it('should get account info', ()=>Exchange.GetAccount().then(log));

	// let pendingOrders = null;
	// it('should get pending orders', ()=>{
	// 	return Exchange.GetOrders().then(a=>{
	// 		expect(a).to.be.an('array');
	// 		pendingOrders = a;
	// 		console.log(a.length,'pending orders');
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

	// let orderId = null;

	// it('should buy', ()=>{
	// 	return Exchange.Buy(300, 0.01).then(i=>{
	// 		console.log('orderId=', i);
	// 	});
	// });

	// it('should get account info', ()=>Exchange.GetAccount().then(log));

	it('should sell', () => {
		return Exchange.Sell(300, 0.001).then(i => {
			console.log('orderId=', i);
		});
	});

	it('should get account info', () => Exchange.GetAccount().then(log));

	it('should sell', () => {
		return Exchange.Buy(300, 0.001).then(i => {
			console.log('orderId=', i);
		});
	});

	it('should get account info', () => Exchange.GetAccount().then(log));

	// it('get order info', ()=>{
	// 	if (orderId) {
	// 		return Exchange.GetOrder(orderId).then(log);
	// 	} else {
	// 		return Promise.resolve(1);
	// 	}
	// });

	// let account = null;
	// it('get account info again', done=>{
	// 	Exchange.GetAccount().then(a=>{
	// 		expect(a.Balance>0).to.be.true;
	// 		expect(a.Stocks>0).to.be.true;
	// 		account = a;
	// 		console.log(a);
	// 		done();
	// 	}).catch(err=>setTimeout(()=>{throw err}));
	// });

	// let sellOrderId = null;
	// it('should sell at 20000', done=>{
	// 	Exchange.Sell(0.05, 0.01).then(orderId=>{
	// 		sellOrderId = orderId;
	// 		done();
	// 	}).catch(err=>setTimeout(()=>{throw err}));
	// });

	// it('get order info', done=>{
	// 	if (sellOrderId) {
	// 		Exchange.GetOrder(sellOrderId).then(o=>{
	// 			console.log(o);
	// 			expect(o).to.be.an('object');
	// 			expect(o.Type).to.equal('Sell');
	// 			done();
	// 		}).catch(err=>setTimeout(()=>{throw err}));
	// 	} else {
	// 		done();
	// 	}
	// });

	// it('cancel sell order ', done=>{
	// 	if (sellOrderId) {
	// 		Exchange.CancelOrder(sellOrderId).then(a=>{
	// 			expect(a).to.be.true;
	// 			done();
	// 		}).catch(err=>setTimeout(()=>{throw err}));
	// 	} else {
	// 		done();
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

	// it('cancel all pending orders', done=>{
	// 	Exchange.CancelPendingOrders().then(a=>{
	// 		console.log(a);
	// 		done();
	// 	}).catch(err=>setTimeout(()=>{throw err}));
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
