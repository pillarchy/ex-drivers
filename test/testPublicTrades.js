const ExDrivers = require('../');

new ExDrivers.OKEX({
	isWS: true,
	Key: 'a',
	Secret: 'a',
	Currency: 'BTC',
	BaseCurrency: 'USDT',
	onPublicTrades(d) {
		console.log(d);
	}
});