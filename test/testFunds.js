const ExDrivers = require('../');
const accounts = require('../accounts.config.json');

let okex = new ExDrivers.OKEX({
	Key: accounts.okex.Key,
	Secret: accounts.okex.Secret,
	Currency: 'BTC',
	BaseCurrency: 'QC'
});

// describe('test accounts related', function() {
// 	this.timeout(5000000);

// 	it('should get ticker', async () => {
// 		console.log(await okex.FundsTransfer('BTC',0.1,'spot','future'));
// 	});

// });

okex.FundsTransfer('BTC',0.1,'spot','future').then(console.log).catch(console.log);