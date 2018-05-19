const ExDrivers = require('../');
const accounts = require('../accounts.config.json');

let okex = new ExDrivers.OKEX({
	Key: accounts.okex.key,
	Secret: accounts.okex.secret,
	Currency: 'BTC',
	BaseCurrency: 'USDT'
});

describe('test accounts related', function() {
	this.timeout(5000000);

	it('should get ticker', async () => {
		console.log(await okex.GetTicker());
	});

	// it('should get account', async () => {
	// 	let a = await okex.GetAccount();
	// 	console.log(a);
	// });

	// it('should get accounts', async () => {
	// 	let a = await okex.GetAccounts();
	// 	console.log(a);
	// });

	// it('should get trades', async () => {
	// 	console.log(await okex.GetTrades());
	// });

});