const Bitstamp = require('bitstamp-ws');
const N = require('precise-number');
const R = require('ramda');
const EXCHANGE = require('../exchange.js');

class BITSTAMP extends EXCHANGE {
	constructor(options) {
		super(options);

		const ws = new Bitstamp();

		ws.on('data', (data) => {
			// console.log('ondata');
			this.onDepth(data);
		});

	}

	onDepth(data) {
		if (data.bids && data.asks && this.options.onDepth) {
			let asks = data.asks.map(([price, amount]) => {
				return {
					Price: N.parse(price),
					Amount: N.parse(amount)
				};
			});

			let bids = data.bids.map(([price, amount]) => {
				return {
					Price: N.parse(price),
					Amount: N.parse(amount)
				};
			});

			let depth = {
				Asks: R.sort( R.ascend( R.prop('Price') ), asks),
				Bids: R.sort( R.descend( R.prop('Price') ), bids)
			};

			this.wsReady = true;

			this.options.onDepth(depth);
		}
	}
}


module.exports = BITSTAMP;
