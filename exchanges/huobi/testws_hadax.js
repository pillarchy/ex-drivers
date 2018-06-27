const ExDrivers = require('../../index.js');
const config = require('../../accounts.config.json');

let HUOBI = new ExDrivers.HADAX({
	Currency: 'IDT',
	BaseCurrency: 'BTC',
	Key: config.huobi.key,
	Secret: config.huobi.secret,
	isWS: true,
	onDepth(data) {
		console.log('onDepth', data.Currency, data.BaseCurrency, data.Asks.length, data.Bids.length, data.Asks[0], data.Bids[0]);
	},
	onTicker(data) {
		console.log('onTicker', data.Currency, data.BaseCurrency, data.Buy, data.Sell, data.Time);
	},
	onPublicTrades(data) {
		console.log('onPublicTrades', data);
	}
});

//subscribe more data
HUOBI.Subscribe('YCC', 'ETH', 'Depth');
HUOBI.Subscribe('YCC', 'ETH', 'Ticker');
HUOBI.Subscribe('YCC', 'ETH', 'PublicTrades');

