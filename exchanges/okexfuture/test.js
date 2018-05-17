global.testing = true;
const chai = require('chai');
const expect = chai.expect;

let config = require('../../accounts.config.json');

const OKEX = require('./index.js');
const Exchange = new OKEX({
	Key: config.okex.key,
	Secret: config.okex.secret,
	Currency: 'LTC',
	MarginLevel: 10,
	BaseCurrency: 'USD',
	Decimals: 3,
	StockDecimals: 0,
	DefaultContactType: 'this_week',
	isWS: false
});

const log = console.log.bind(console);

describe('test okex rest api', function () {
	this.timeout(30000);

	it('should get ticker', async () => {
		for (let i = 0; i < 10; i++) {
			await Exchange.GetTicker('this_week').then(log);
		}
	});

	it('should get depth', () => Exchange.GetDepth('next_week').then(log));

	it('should get position info', () => Exchange.GetPosition().then(log));

	it('should get account info', () => Exchange.GetAccount().then(log));

	let orderId = null;
	it('should open 1 short', () => Exchange.Trade('short', 145, 1).then(id => {
		orderId = id;
		console.log('got order id', id);
	}));

	it('should get pending orders', async () => {
		console.log(await Exchange.GetOrders());
	});

	// it('cancel fake order ', () => {
	// 	return Exchange.CancelOrder(1234567).then(a => {
	// 		setTimeout(() => {
	// 			throw new Error('this should throw an error. but it didnt');
	// 		});
	// 	}).catch(err => {
	// 		log(err);
	// 	});
	// });

	// it('get fake order ', () => {
	// 	return Exchange.GetOrder(1234567).then(a => {
	// 		throw new Error('this should throw an error. but it didnt');
	// 	}).catch(err => {
	// 		log(err);
	// 	});
	// });

	// it('cancel pending orders ', () => {
	// 	if (pendingOrders && pendingOrders.length > 0) {
	// 		let o = pendingOrders.shift();
	// 		console.log('cancelling order ', o.Id);
	// 		return Exchange.CancelOrder(o.Id).then(a => {
	// 			expect(a).to.be.true;
	// 		});
	// 	} else {
	// 		console.log('no pending orders');
	// 		return Promise.resolve(1);
	// 	}
	// });



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

	// it('get order info', async () => {
	// 	let o = await Exchange.GetOrder(orderId, 'quarter');
	// 	console.log(o);
	// 	expect(o).to.be.an('object');
	// 	expect(o.Type).to.equal('Sell');
	// });

	// it('cancel sell order ', async () => {
	// 	console.log(await Exchange.CancelOrder(orderId, 'quarter'));
	// });

	// // it('should sell', ()=>Exchange.Sell(0.044, 0.01));

	// // it('should sell', done=>{
	// // 	Exchange.Sell(0.046, 0.01).then(orderId=>{
	// // 		done();
	// // 	}).catch(err=>setTimeout(()=>{throw err}));
	// // });

	// // it('should sell', done=>{
	// // 	Exchange.Sell(0.05, 0.01).then(orderId=>{
	// // 		done();
	// // 	}).catch(err=>setTimeout(()=>{throw err}));
	// // });

	// // it('should buy', done=>{
	// // 	Exchange.Buy(0.04, 0.01).then(orderId=>{
	// // 		done();
	// // 	}).catch(err=>setTimeout(()=>{throw err}));
	// // });

	it('cancel all pending orders', async () => {
		console.log(await Exchange.CancelPendingOrders());
	});

	// // it('get account info again', done=>{
	// // 	Exchange.GetAccount().then(a=>{
	// // 		console.log(a);
	// // 		expect(a.Balance>0).to.be.true;
	// // 		expect(a.Stocks>=0).to.be.true;
	// // 		done();
	// // 	}).catch(err=>setTimeout(()=>{throw err}));
	// // });

});
