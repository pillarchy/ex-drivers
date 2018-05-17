const path = require('path');

global.testing = true;
global.chai = require('chai');
global.expect = chai.expect;

const assert = require('assert');

let config = require('../../accounts.config.json');
const N = require('precise-number');
const wait = require('delay');

const OKCoin = require('./index.js');
const Exchange = new OKCoin({
	Key: config.okex.key,
	Secret: config.okex.secret,
	Currency: 'BTC',
	BaseCurrency: 'USDT',
	isWS: true,
	DefaultContactType: 'quarter',
	MarginLevel: 10,
	onDepth(depth) {
		console.log('on depth', depth.Asks.pop().Price, depth.Bids[0].Price);
	},
	onPositionChange(data) {
		console.log('on position change', data);
	},
	onTrade(data) {
		console.log('on trade', data);
	},
	onIndex(data) {
		console.log('on index', data);
	},
	onAccountChange(data) {
		console.log('on account change', data);
	},

	onTicker(data) {
		console.log('on ticker', data);
	}
});

const log = console.log.bind(console);

describe('test okex websocket', function() {

	this.timeout(100000000);

	it('should get index kline', async () => {
		console.log(await Exchange.GetAvgPriceShift());

		console.log('position is', await Exchange.GetPosition());

	});

	it('should wait a long time', async () => {



		console.log('wait until ws ready');
		await Exchange.waitUntilWSReady();
		console.log('ws ready');
		await wait(100000000);
	});

});