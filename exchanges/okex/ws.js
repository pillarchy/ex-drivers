const OKWS = require('./okex.ws.js');
const Queue = require('../../lib/queue.js');
const N = require('precise-number');
const R = require('ramda');
const wait = require('delay');
const debug = require('debug')('okex:ws');

class EXCHANGE {

	constructor(options) {
		this.options = options;
		this.symbol = options.Currency.toLowerCase() + '_' + options.BaseCurrency.toLowerCase();
		this.options.Symbol = this.symbol;
		this.options.onConnect = () => {
			debug('onConnect');
			this.wsReady = true;
		};

		this.ws = new OKWS(this.options);

		this.ws.onConnect = options.onConnect;

		this.wsReady = false;

		let handlers = {};

		if (this.options.onDepth) {
			handlers[`ok_sub_spot_${this.symbol}_depth_20`] = (data, err) => {
				this.onDepth(data, err);
			};
		}

		if (options.onAccountChange) {
			handlers[`ok_sub_spot_${this.symbol}_balance`] = (data, err) => {
				this.onAccountChange(data, err);
			};
		}

		if (options.onTicker) {
			handlers[`ok_sub_spot_${this.symbol}_ticker`] = (data, err) => {
				this.onTicker(data, err);
			};
		}

		if (options.onTrade) {
			handlers[`ok_sub_spot_${this.symbol}_order`] = (data, err) => {
				this.onTrade(data, err);
			};
		}

		if (options.onPublicTrades) {
			handlers[`ok_sub_spot_${this.symbol}_deals`] = (data, err) => {
				this.onPublicTrades(data, err);
			};
		}

		this.ws.subscribe(handlers);

		this.cb = options.onUpadte ? options.onUpadte : function() { };
	}

	onPublicTrades(data) {
		if (this.options.onPublicTrades) {
			data = data.map(t => {
				return {
					Id: t[0],
					Price: N.parse(t[1]),
					Amount: N.parse(t[2]),
					Time: Date.now(),
					Type: t[4] === 'ask' ? 'Buy' : 'Sell'
				};
			});
			this.options.onPublicTrades(data);
		}	
	}

	onTicker(data) {
		/*
		{ high: '0.05612832',
		  vol: '128795.274296',
		  last: '0.05586972',
		  low: '0.05350554',
		  buy: '0.0557892',
		  change: '0.00090871',
		  sell: '0.05595013',
		  dayLow: '0.05350554',
		  close: '0.05586972',
		  dayHigh: '0.05612832',
		  open: '0.05496101',
		  timestamp: 1522904232875 }
		 */
		let re = {
			Open: N.parse(data.open),
			High: N.parse(data.high),
			Low: N.parse(data.low),
			Close: N.parse(data.close),
			Buy: N.parse(data.buy),
			Sell: N.parse(data.sell),
			Volume: N.parse(data.vol),
			Time: N.parse(data.timestamp)
		};
		if (this.options.onTicker) {
			this.options.onTicker(re);
		}
	}

	onAccountChange(data) {
		/*
		{ info: { free: { btc: 0.0832314327132 }, freezed: { btc: 0 } } }
		 */
		if (typeof this.options.onAccountChange === 'function' && data) {
			if (data && data.info) {
				if (data.info.free) {
					Object.keys(data.info.free).map(c => {
						if (c.toLowerCase() === this.options.BaseCurrency.toLowerCase()) {
							this.options.onAccountChange('Balance', N.parse(data.info.free[c]));
						} else if (c.toLowerCase() === this.options.Currency.toLowerCase()) {
							this.options.onAccountChange('Stocks', N.parse(data.info.free[c]));
						}
					});

					Object.keys(data.info.freezed).map(c => {
						if (c.toLowerCase() === this.options.BaseCurrency.toLowerCase()) {
							this.options.onAccountChange('FrozenBalance', N.parse(data.info.freezed[c]));
						} else if (c.toLowerCase() === this.options.Currency.toLowerCase()) {
							this.options.onAccountChange('FrozenStocks', N.parse(data.info.freezed[c]));
						}
					});
				}
			}
		}
	}

	onTrade(data, err) {
		if (typeof this.options.onTrade === 'function' && !err) {
			this.options.onTrade(data);
		}
	}

	async waitUntilWSReady() {
		while (!this.wsReady) {
			console.log('okex ws not ready');
			await wait(300);
		}
	}

	onDepth(data, err) {
		if (!err && data && data.bids && data.asks) {

			let asks = [];
			let bids = [];

			for (let i = 0;i < data.bids.length;i++) {
				bids.push({
					Price: data.bids[i][0] * 1,
					Amount: data.bids[i][1] * 1
				});
			}

			for (let i = 0;i < data.asks.length;i++) {
				asks.push({
					Price: data.asks[i][0] * 1,
					Amount: data.asks[i][1] * 1
				});
			}

			data = {
				Asks: R.sort( R.ascend( R.prop('Price') ), asks),
				Bids: R.sort( R.descend( R.prop('Price') ), bids)
			};
		} else {
			err = true;
		}
		if (typeof this.options.onDepth === 'function') {
			if (!err) {
				this.options.onDepth(data);
			}
		}
	}

}


module.exports = EXCHANGE;
