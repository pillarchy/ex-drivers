const { OKEX: EX } = require('../../index.js');
const config = require('../../accounts.config.json');

let ex = new EX({
	Currency: 'BTC',
	BaseCurrency: 'USDT',
	Key: config.okex.key,
	Secret: config.okex.secret,
	isWS: true,
	onDepth(data) {
		console.log('onDepth', data.Currency, data.BaseCurrency, data.Asks.length, data.Bids.length);
	},
	onTicker(data) {
		console.log('onTicker', data);
	},
	onPublicTrades(data) {
		console.log('onPublicTrades', data);
	}
});

//subscribe more data
ex.Subscribe('EOS', 'BTC', 'Depth');
ex.Subscribe('EOS', 'BTC', 'Ticker');
ex.Subscribe('EOS', 'BTC', 'PublicTrades');

