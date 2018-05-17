const ExDrivers = require('../');

new ExDrivers.BINANCE({
	isWS: true,
	WSKey: 'a',
	WSSecret: 'a',
	Currency: 'ETH',
	BaseCurrency: 'USDT',
	onDepth(d) {
		d.Asks = d.Asks.slice(0, 20).reverse();
		d.Bids = d.Bids.slice(0, 20);
		console.log(d);
	}
});