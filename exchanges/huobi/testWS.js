const path = require('path');

global.chai = require('chai');
global.expect = chai.expect;

const assert = require('assert');

let config = require('../../accounts.config.json');
const N = require('precise-number');
const wait = require('delay');

const EX = require('./index.js');
const Exchange = new EX({
	Key: config.huobipro.key,
	Secret: config.huobipro.secret,
	isWS: true,
	onDepth: (depth) => {
		console.log(depth);
	},
	onPong: (ms) => {
		console.log('delay', ms);
	},
	Currency: 'EOS',
	BaseCurrency: 'ETH'
});

const log = console.log.bind(console);

describe('test huobipro websocket', function() {

	this.timeout(100000000);

	it('should wait a long time', () => wait(100000000));

});