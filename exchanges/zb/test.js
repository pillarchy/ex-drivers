const { ZB } = require('../../index.js');
const config = require('../../accounts.config.json');
require('./nock.js');

let ex = new ZB({
	Currency: 'USDT',
	BaseCurrency: 'QC',
	Decimals: 2,
	StockDecimals: 3,
	Key: config.zb.key,
	Secret: config.zb.secret,
	isWS: false
});

describe('test zb', function() {
	this.timeout(1000);

	it('should get account', async () => {
		console.log(await ex.GetAccount());
	});

	it('should buy', async () => {
		console.log(await ex.Buy(5.555555555, 1.11111111111));
	});

	it('should sell', async () => {
		console.log(await ex.Sell(5.555555555, 1.11111111111));
	});

});