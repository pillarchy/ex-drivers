const ExDrivers = require('../../index.js');
const config = require('../../accounts.config.json');
const ex = new ExDrivers.BITFINEX({
	Key: config.bitfinex.key,
	Secret: config.bitfinex.secret,
	Currency: 'BTC',
	BaseCurrency: 'USD'
});

describe('test bitfinex driver', function() {
	this.timeout(10000);

	it('should get ticker', async () => {
		console.log(await ex.GetTicker());
	});

	it('should get accounts', async () => {
		console.log(await ex.GetAccounts());
	});

	it('should get account', async () => {
		console.log(await ex.GetAccount());
	});
});