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
	Key: config.okex_lclgg002.key,
	Secret: config.okex_lclgg002.secret,
	Currency: 'ETH',
	BaseCurrency: 'BTC',
	isWS: true,
	// onTicker(t) {
	// 	console.log(t);
	// }
	// onDepth(d) {
	// 	console.log(d);
	// }
	onTrade(d) {
		console.log('onTrade', d);
	},

	onAccountChange(a) {
		console.log('on account change', a);
	}
	// onDepth: function(depth) {
	// 	// console.log('on depth', depth);
	// }
});

const log = console.log.bind(console);

describe('test okex websocket', function() {

	this.timeout(100000000);

	it('should wait a long time', () => wait(100000000));
	
	it('should get order', () => {
		return Exchange.GetAccount().then(log);
	});

});