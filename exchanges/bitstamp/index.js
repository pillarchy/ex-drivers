const Bitstamp = require('bitstamp-ws');
const N = require('precise-number');
const R = require('ramda');
const wait = require('delay');

class EXCHANGE {
	constructor(options) {
		this.options = options;
		this.wsReady = false;

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
				Asks: R.sort( R.descend( R.prop('Price') ), asks),
				Bids: R.sort( R.descend( R.prop('Price') ), bids)
			};

			this.wsReady = true;

			this.options.onDepth(depth);
		}
	}


	async waitUntilWSReady() {
		let startTime = Date.now();
		while (!this.wsReady) {
			await wait(200);
			if (Date.now() - startTime > 30000) throw new Error('bitstamp websocket timeout');
		}
		return true;
	}

}


module.exports = EXCHANGE;
