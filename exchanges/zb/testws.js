const ExDrivers = require('../../index.js');
const config = require('../../accounts.config.json');

let zb = new ExDrivers.ZB({
	Currency: 'BTC',
	BaseCurrency: 'QC',
	Key: config.zb.key,
	Secret: config.zb.secret,
	isWS: true,
	onDepth(data) {
		console.log('onDepth', data);
	},
	onTicker(data) {
		console.log('onTicker', data);
	},
	onPublicTrades(data) {
		console.log('onPublicTrades', data);
	}
});

//subscribe more data
zb.Subscribe('EOS', 'QC', 'Depth');
zb.Subscribe('EOS', 'QC', 'Ticker');
zb.Subscribe('EOS', 'QC', 'PublicTrades');

setInterval(async () => {
	zb.GetAccount().then(data => {
		console.log(data.Balance, data.Info.route);
	}).catch(err => {
		console.error(err.message, err.code, err);
	});
}, 2000);
