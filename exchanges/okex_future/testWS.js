const { OKEX_FUTURE: EX } = require('../../index.js');
const config = require('../../accounts.config.json');

let ex = new EX({
	Currency: 'BTC',
	BaseCurrency: 'USD',
	Key: config.okex.key,
	Secret: config.okex.secret,
	isWS: true,
	DefaultContactType: 'quarter',
	// onDepth(data) {
	// 	console.log('onDepth', data.Currency, data.BaseCurrency, data.ContractType, data.Asks[0].Price, data.Bids[0].Price);
	// },
	// onTicker(data) {
	// 	console.log('onTicker', data.Currency, data.BaseCurrency, data.Buy, data.Sell);
	// },
	onPublicTrades(data) {
		console.log('onPublicTrades', data);
	}
});

//subscribe more data
// ex.Subscribe('BTC', 'USD', 'Depth', 'this_week');
// ex.Subscribe('EOS', 'USD', 'Ticker');
// ex.Subscribe('EOS', 'USD', 'PublicTrades');

