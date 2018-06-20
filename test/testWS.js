const ExDrivers = require('../');

new ExDrivers.BITFLYER_FX({
	isWS: true,
	Key: '_',
	Secret: '_',
	Currency: 'BTC',
	BaseCurrency: 'USDT',
	onIndex(i) {
		console.log('index', i);
	},
	onDepth(d) {
		d.Asks = d.Asks.slice(0, 20).reverse();
		d.Bids = d.Bids.slice(0, 20);
		console.log(d);
	}
});