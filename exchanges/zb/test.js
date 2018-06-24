const { ZB } = require('../../index.js');
const config = require('../../accounts.config.json');
// require('./nock.js');
const wait = require('delay');
const moment = require('moment');

let ex = new ZB({
	Currency: 'BTC',
	BaseCurrency: 'QC',
	Key: config.zb.key,
	Secret: config.zb.secret,
	isWS: false
});

let ids = {};

describe('test zb', function() {
	this.timeout(10000000);

	it('should get account', async () => {
		console.log(await ex.GetAccount());
	});

	it('should get trades', async () => {
		while ( true ) {
			try {
				let arr = await ex.GetTrades();
				arr = arr.filter(o => {
					return !ids[o.Id];
				});

				arr = arr.map(o => {
					ids[o.Id] = true;
					delete o.Info;
					o.Time = moment(o.Time).format('YYYY-MM-DD HH:mm:ss:SSS');
					return o;
				});

				console.log(arr);
			} catch (err) {
				console.error(err);
			}
			await wait(1000);
		}
	});



	// it('should buy', async () => {
	// 	console.log(await ex.Buy(5.555555555, 1.11111111111));
	// });

	// it('should sell', async () => {
	// 	console.log(await ex.Sell(5.555555555, 1.11111111111));
	// });

});