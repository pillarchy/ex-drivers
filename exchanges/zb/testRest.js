const ex = require('./index.js');
const config = require('../../accounts.config.json');

let zb = new ex({
	Currency: 'BTC',
	BaseCurrency: 'USDT',
	Key: config.zb_zhujing.key,
	Secret: config.zb_zhujing.secret,
	isWS: false,
	//DefaultDepthMerge: 0.01,
	DefaultDepthSize: 50
});

const log = console.log.bind(console);

describe('test zb rest', function() {
	this.timeout(10000);

	// it('should get account', () => zb.GetAccount().then(log));

	// it('should get ticker', ()=>zb.GetTicker().then(log));
	it('should get depth', () => zb.GetDepth().then(log));


});
