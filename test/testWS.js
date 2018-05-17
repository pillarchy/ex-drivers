const ExDrivers = require('../');

new ExDrivers.BITTREX({
	isWS: true,
	Key: 'a',
	Secret: 'a',
	Currency: 'BTC',
	BaseCurrency: 'USDT',
	onDepth(d) {
		d.Asks = d.Asks.slice(0, 20).reverse();
		d.Bids = d.Bids.slice(0, 20);
		console.log(d);
	}
});