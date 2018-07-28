const { BITFINEX: EX } = require('../../index.js');
const config = require('../../accounts.config.json');

let ex = new EX({
	Currency: 'BTC',
	BaseCurrency: 'USD',
	Key: 'a', //config.bitfinex.key,
	Secret: config.bitfinex.secret,
	isWS: true,
	onDepth(data) {
		console.log('onDepth', data.Currency, data.BaseCurrency, data.Asks[0].Price, data.Bids[0].Price, data);
	}
});
