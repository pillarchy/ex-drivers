global.testing = true;
const chai = require('chai');
const expect = chai.expect;

let config = require('../../accounts.config.json');

const OKCoin = require('./index.js');
const Exchange = new OKCoin({
	Key: config.okex_lclgg002.key,
	Secret: config.okex_lclgg002.secret,
	Currency: 'ETH',
	BaseCurrency: 'BTC',
	isWS: true,
	// onAccountChange(a) {
	// 	console.log('on account change', a);
	// },
	onIndex(index) {
		console.log('on index', index);
	}
});

const log = console.log.bind(console);

describe('test okex rest api', function () {
	this.timeout(30000);

	it('should wait until ws ready', () => Exchange.waitUntilWSReady());

	it('should get ticker', () => Exchange.GetTicker().then(log));

	it('should get depth', () => Exchange.GetDepth().then(log));

	it('should get account info', () => Exchange.GetAccount().then(log));

	let pendingOrders = null;
	it('should get pending orders', () => {
		return Exchange.GetOrders().then(a => {
			log(a);
			expect(a).to.be.an('array');
			pendingOrders = a;
			console.log(a.length, 'pending orders');
		});
	});

	it('cancel fake order ', () => {
		return Exchange.CancelOrder(1234567).then(a => {
			log('fake order then:', a);	
		}).catch(err => {
			log('fake order catch:', err);
		});
	});

	it('get fake order ', () => {
		return Exchange.GetOrder(1234567).then(a => {
			throw new Error('this should throw an error. but it didnt');
		}).catch(err => {
			log(err);
		});
	});

	it('cancel pending orders ', () => {
		if (pendingOrders && pendingOrders.length > 0) {
			let o = pendingOrders.shift();
			console.log('cancelling order ', o.Id);
			return Exchange.CancelOrder(o.Id).then(a => {
				expect(a).to.be.true;
			});
		} else {
			console.log('no pending orders');
			return Promise.resolve(1);
		}
	});

	// let orderId = null;

	// it('should buy', () => {
	// 	return Exchange.Buy(8000, 0.01).then(i => {
	// 		console.log('orderId=', i);
	// 		orderId = i;
	// 	});
	// });


	// it('get order info', () => {
	// 	if (orderId) {
	// 		return Exchange.GetOrder(orderId).then(log);
	// 	} else {
	// 		return Promise.resolve(1);
	// 	}
	// });

	// let account = null;
	// it('get account info again', done => {
	// 	Exchange.GetAccount().then(a => {
	// 		expect(a.Balance > 0).to.be.true;
	// 		expect(a.Stocks > 0).to.be.true;
	// 		account = a;
	// 		console.log(a);
	// 		done();
	// 	}).catch(err => setTimeout(() => {throw err;}));
	// });

	// let sellOrderId = null;
	// it('should sell at 20000', done => {
	// 	Exchange.Sell(10000, 0.001).then(orderId => {
	// 		sellOrderId = orderId;
	// 		done();
	// 	}).catch(err => setTimeout(() => {throw err;}));
	// });

	// it('get order info', done => {
	// 	if (sellOrderId) {
	// 		Exchange.GetOrder(sellOrderId).then(o => {
	// 			console.log(o);
	// 			expect(o).to.be.an('object');
	// 			expect(o.Type).to.equal('Sell');
	// 			done();
	// 		}).catch(err => setTimeout(() => {throw err;}));
	// 	} else {
	// 		done();
	// 	}
	// });

	// it('cancel sell order ', () => {
	// 	if (sellOrderId) {
	// 		return Exchange.CancelOrder(sellOrderId).then(a => {
	// 			expect(a).to.be.true;
	// 			console.log(a);
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

	it('cancel all pending orders', done => {
		Exchange.CancelPendingOrders().then(a => {
			console.log(a);
			done();
		}).catch(err => setTimeout(() => {throw err;}));
	});

	// it('get account info again', done=>{
	// 	Exchange.GetAccount().then(a=>{
	// 		console.log(a);
	// 		expect(a.Balance>0).to.be.true;
	// 		expect(a.Stocks>=0).to.be.true;
	// 		done();
	// 	}).catch(err=>setTimeout(()=>{throw err}));
	// });

});
