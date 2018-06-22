const ExDrivers = require('../');
const accounts = require('../accounts.config.json');

let zb = new ExDrivers.ZB({
	Key: accounts.zb.key,
	Secret: accounts.zb.secret,
	Currency: 'BTC',
	BaseCurrency: 'QC'
});

describe('test accounts related', function() {
	this.timeout(5000000);

	it('should get ticker', async () => {
		console.log(await zb.GetTicker());
	});

	it('should get account', async () => {
		let a = await zb.GetAccount();
		console.log(a);
	});

	it('should get accounts', async () => {
		let a = await zb.GetAccounts();
		console.log(a);
	});

	it('should get trades', async () => {
		console.log(await zb.GetTrades());
	});

});