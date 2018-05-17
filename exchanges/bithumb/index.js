const N = require('precise-number');
const { ok, equal } = require('assert');
const R = require('ramda');
const moment = require('moment');
const Bithumb = require('bithumb.js');
const debug = require('debug')('bithumb');
const WebSocket = require('../../lib/auto-reconnect-ws.js');
const debugWS = require('debug')('bithumb-ws');
const delay = require('delay');

let errorCodes = {
	'5100':	'Bad Request',
	'5200':	'Not Member',
	'5300':	'Invalid Apikey',
	'5302':	'Method Not Allowed',
	'5400':	'Database Fail',
	'5500':	'Invalid Parameter',
	'5600':	'CUSTOM NOTICE',
	'5900':	'Unknown Error'
};

class EXCHANGE {
	constructor(options) {
		if (!options.Currency) throw new Error('no Currency');
		if (!options.BaseCurrency) options.BaseCurrency = 'USDT';
		this.Currency = options.Currency;
		this.BaseCurrency = options.BaseCurrency;
		this.options = options;
		this.symbol = this.Currency;

		//韩元与美元兑换汇率
		if (!this.options.Rate) this.options.Rate = 0.00091;
	
		this.fee = {
			BuyMaker: 0.15,
			SellMaker: 0.15,
			BuyTaker: 0.15,
			SellTaker: 0.15
		};

		if (options.isWS) {
			debugWS('connecting ', 'wss://wss.bithumb.com/public');
			this.ws = new WebSocket('wss://wss.bithumb.com/public', {
				headers: {
 					'Origin': 'https://www.bithumb.com'
				}
			});
			this.ws.on('open', () => {
				debugWS('connected');
				this.ws.send('{"currency":"' + this.symbol + '","service":"orderbook"}');
			});

			this.wsReady = false;

			this.ws.on('message', s => {
				debugWS('message', s);
				try {
					let {data, header, status} = JSON.parse(s);
					if (header && header.service === 'orderbook') {
						let total = data.asks.length + data.bids.length;
						this.updateOrderBook(data);
					}
				} catch ( err ) {}
			});
		}

		this.bithumb = new Bithumb(options.Key, options.Secret);
		this.rest = (method, ...args) => {
			debug('<<<', method, args);
			return this.bithumb[method](...args).then(data => {
				debug('>>>', method, args, data);
				if (!data) throw new Error(`bithumb ${method} returns empty`);
				let code = data.status || '5900';
				if (code === '0000') {
					if (data.order_id) return data.order_id;
					return data.data;
				}
				throw new Error(`bithumb ${method} returns error(${errorCodes[code] || 'unknown error'}): ` + JSON.stringify(data));
			});
		};
	}

	loop() {
		this.GetDepth().then(depth => {
			if (this.options.onDepth) this.options.onDepth(depth);
			setTimeout(() => {
				this.loop();
			}, 0);
		}).catch(err => {
			console.error('bithumb loop error', err);
			setTimeout(() => {
				this.loop();
			}, 2000);
		});
	}


	updateOrderBook(data) {
		debugWS('update order book');
		// console.log('on orderbook update');
		// if (!this.orderbook) 
		this.orderbook = {Asks: {}, Bids: {}};

		if (data.bids && data.bids.length > 0) {
			data.bids.map(d => {
				let price = d.price;
				let quantity = N.parse(d.quantity);
				if (quantity > 0) {
					this.orderbook.Bids[d.price] = quantity;
					Object.keys(this.orderbook.Asks).map(aprice => {
						if (N.parse(price) > N.parse(aprice)) this.orderbook.Asks[aprice] = 0;
					});
				} else {
					delete(this.orderbook.Bids[price]);
				}
			});
		}

		if (data.asks && data.asks.length > 0) {
			data.asks.map(d => {
				let price = d.price;
				let quantity = N.parse(d.quantity);
				if (quantity > 0) {
					this.orderbook.Asks[price] = quantity;
					Object.keys(this.orderbook.Bids).map(aprice => {
						if (N.parse(price) < N.parse(aprice)) this.orderbook.Bids[aprice] = 0;
					});
				} else {
					delete(this.orderbook.Asks[d[0]]);
				}
			});
		}

		let asks = Object.keys(this.orderbook.Asks).map(price => {
			return {
				Price: price,
				Amount: N.parse(this.orderbook.Asks[price])
			};
		}).filter(d => d.Amount > 0);

		let bids = Object.keys(this.orderbook.Bids).map(price => {
			return {
				Price: price,
				Amount: N.parse(this.orderbook.Bids[price])
			};
		}).filter(d => d.Amount > 0);

		this.orderbook = { Asks:{}, Bids:{}};
		asks.map(r => {
			this.orderbook.Asks[r.Price] = r.Amount;
		});
		bids.map(r => {
			this.orderbook.Bids[r.Price] = r.Amount;
		});

		this.onDepthData();
	}


	onDepthData() {
		if (!this.orderbook) return;
		if (!this.wsReady) this.wsReady = true;

		if (typeof this.options.onDepth === 'function') {

			let asks = Object.keys(this.orderbook.Asks).map(price => {
				return {
					Price: this.parsePrice(price),
					Amount: N.parse(this.orderbook.Asks[price])
				};
			}).filter(d => d.Amount > 0);

			let bids = Object.keys(this.orderbook.Bids).map(price => {
				return {
					Price: this.parsePrice(price),
					Amount: N.parse(this.orderbook.Bids[price])
				};
			}).filter(d => d.Amount > 0);

			let depth = {
				Asks: R.sort( R.descend( R.prop('Price') ), asks).slice(-20),
				Bids: R.sort( R.descend( R.prop('Price') ), bids).slice(0, 20)
			};

			this.options.onDepth(depth);
		}
	}


	waitUntilWSReady() {
		// console.log('waiting...');
		return new Promise((done, reject) => {
			let timer = setInterval(() => {
				if (this.wsReady) {
					done();
					clearInterval(timer);
				}
			});

			setTimeout(() => {
				if (this.wsReady) return;
				clearInterval(timer);
				debugWS('waitUntilWSReady timeout');
				reject();
			}, 30000);
		});
	}

	SetFee(fee) {
		ok(fee, 'no fee');
		ok(fee.BuyMaker);
		ok(fee.BuyTaker);
		ok(fee.SellMaker);
		ok(fee.BuyMaker);
		this.fee = fee;
	}

	GetFee() {
		return this.fee;
	}

	GetName() {
		return this.options.Name ? this.options.Name : 'Bithumb';
	}

	parsePrice(p) {
		p = N.parse(p);
		return N(p).multiply(this.options.Rate).floor(2) * 1;
	}

	GetTicker() {
		return this.rest('getTicker', this.symbol).then(data => {
			return {
				Buy: this.parsePrice(data.buy_price),
				Sell: this.parsePrice(data.sell_price),
				Last: this.parsePrice(data.closing_price),
				Time: Date.now(),
				High: this.parsePrice(data.max_price),
				Low: this.parsePrice(data.min_price)
			};
		});
	}

	GetDepth(size) {
		if (!size) size = 20;
		return this.rest('getOrderbook', this.symbol).then(data => {
			let asks = data.asks.map(r => {
				return {
					Price: this.parsePrice(r.price),
					Amount: N.parse(r.quantity)
				};
			});

			let bids = data.bids.map(r => {
				return {
					Price: this.parsePrice(r.price),
					Amount: N.parse(r.quantity)
				};
			});

			return Promise.resolve({
				Asks: R.sort( R.descend( R.prop('Price') ), asks).slice(-size),
				Bids: R.sort( R.descend( R.prop('Price') ), bids).slice(0, size)
			});
		});
	}

	GetAccount() {
		return this.rest('getBalance', this.symbol).then(data => {
			return {
				Balance: this.parsePrice(data.available_krw),
				FrozenBalance: this.parsePrice(data.in_use_krw),
				Stocks: N.parse(data['available_' + this.symbol.toLowerCase()]),
				FrozenStocks: N.parse(data['in_use_' + this.symbol.toLowerCase()]),
			};
		});
	}

	GetOrders() {
		return Promise.resolve([]);
	}


	GetOrder(orderId) {
		throw new Error('bithumb can not get order detail');
	}

	GetMin() {
		let limits = {
			BTC: 0.001,
			ETH: 0.01,
			DASH: 0.01,
			LTC: 0.1,
			ETC: 0.1,
			XRP: 10,
			BCH: 0.001,
			XMR: 0.01,
			ZEC: 0.001,
			QTUM: 0.1,
			BTG: 0.01
		};
		if (limits[this.symbol]) return limits[this.symbol];
		throw new Error('unknown bithumb coin type ' + this.symbol);
	}

	Sell(price, amount) {
		return this.Trade('marketSell', amount);	
	}

	Buy(price, amount) {
		return this.Trade('marketBuy', amount);	
	}

	async Trade(type, amount) {
		debug(type, amount);
		amount = N(amount).round(3) * 1;
		debug(type, amount);
		console.log('bithumb', type, amount);

		let tried = 0, re;
		while ( true ) {
			tried++;
			try {
				re = await this.rest(type, amount, this.symbol);
				debug('result', re);
			} catch (err) {
				debug('error got', err);
				if (err && err.message && err.message.match(/5600|5100/) && tried <= 5) {
					console.log('bithumb got error, retry ' + tried);
					await delay(1000);
					continue;
				} else {
					throw err;
				}
			}
			break;
		}
		return re;
	}

	CancelOrder(orderId) {
		throw new Error('bithumb does not support cancel order');
	}

	CancelPendingOrders() {
		return delay(5000).then(() => {
			throw new Error('bithumb does not support cancel pending orders');
		});
	}

}


module.exports = EXCHANGE;
