const BitMEXClient = require('bitmex-realtime-api');
const debug = require('debug')('bitmex:ws');
const assert = require('better-assert');
const N = require('precise-number');

class Exchange {
	constructor(options) {
		assert(options.Key);
		assert(options.Secret);

		this.options = options;
		this.symbol = (options.Currency + options.BaseCurrency).toUpperCase();
		this.client = new BitMEXClient({
			testnet: false,
			apiKeyID: this.options.Key,
			apiKeySecret: this.options.Secret
		});

		this.client.on('error', err => {
			console.error(err);
		});

		this.lastDepth = {};
		if (this.options.onDepth) {
			this.client.addStream(this.symbol, 'orderBook10', (data, symbol, tableName) => {
				debug('on order book data');
				this._onDepth(data, symbol, tableName);
			});
		}
	}

	_onDepth(data) {
		if (data && data.length > 0) {
			data = data[data.length - 1];
			let { asks, bids, symbol, timestamp } = data;
			if (!asks || !bids || !symbol || !timestamp) return;

			let Currency = symbol.replace('USD', '');
			let BaseCurrency = 'USD';

			asks = asks.map(pair => {
				return {
					Price: N.parse(pair[0]),
					Amount: N.parse(pair[1])
				};
			});

			bids = bids.map(pair => {
				return {
					Price: N.parse(pair[0]),
					Amount: N.parse(pair[1])
				};
			});

			let depth = {
				Time: new Date(timestamp).getTime(),
				Asks: asks,
				Bids: bids,
				Currency,
				BaseCurrency
			};

			if (this.depthChanged(symbol, depth)) {
				this.lastDepth[symbol] = depth;
				this.options.onDepth(depth);
			}
		}
	}

	depthChanged(key, depth) {
		let old = this.lastDepth[key];
		if (!old) return true;
		if (depth.Asks[0].Price !== old.Asks[0].Price) return true;
		if (depth.Bids[0].Price !== old.Bids[0].Price) return true;
		if (Math.abs(depth.Asks[0].Amount - old.Asks[0].Amount) / old.Asks[0].Amount > 0.2) return true;
		if (Math.abs(depth.Bids[0].Amount - old.Bids[0].Amount) / old.Bids[0].Amount > 0.2) return true;
		return false;	
	}
}


module.exports = Exchange;