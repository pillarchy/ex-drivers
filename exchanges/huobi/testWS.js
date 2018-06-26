const ExDrivers = require('../../index.js');
const config = require('../../accounts.config.json');

let HUOBI = new ExDrivers.HUOBI({
	Currency: 'BTC',
	BaseCurrency: 'USDT',
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
HUOBI.Subscribe('EOS', 'USDT', 'Depth');
HUOBI.Subscribe('EOS', 'USDT', 'Ticker');
HUOBI.Subscribe('EOS', 'USDT', 'PublicTrades');

