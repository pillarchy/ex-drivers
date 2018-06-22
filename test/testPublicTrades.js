const ExDrivers = require('../');

let ex = new ExDrivers.OKEX({
	isWS: true,
	Key: 'a',
	Secret: 'a',
	Currency: 'BTC',
	BaseCurrency: 'USDT',
	onPublicTrades(d) {
		// console.log('onPublicTrades', d.length);
		console.log(d);
	},
	onConnect() {
		addChannel('eth_usdt');
		addChannel('eos_usdt');
		addChannel('etc_usdt');
		addChannel('bch_usdt');
	}
});



function addChannel(symbol) {
	ex.ws.ws.channels[`ok_sub_spot_${symbol}_deals`] = (data, err) => {
		if (!err) ex.ws.onPublicTrades(data, symbol);
	};

	let d = {event: 'addChannel', channel: `ok_sub_spot_${symbol}_deals`};
	let _d = JSON.stringify(d).replace(/\"/g, "'");
	ex.ws.ws.ws.send(_d);
}
