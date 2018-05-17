const N = require('precise-number');
const { ok } = require('assert');
const R = require('ramda');
const api = require('./lib/binance.js');
const EXCHANGE = require('../exchange.js');

class BINANCE extends EXCHANGE {
	constructor(options) {
		options = Object.assign({
			Name: 'Binance',
			Fees: {
				Taker: 0.002,
				Maker: 0.002
			}
		}, options);

		super(options);
		this.Currency = options.Currency;
		this.options = options;
		this.symbol = options.Currency + 'USDT';
	

		this.restAPI = new api.BinanceRest({
			key: options.Key,
			secret: options.Secret,
			timeout: 10000,
			disableBeautification: false
			/*
			 * Optional, default is false. Binance's API returns objects with lots of one letter keys.  By
			 * default those keys will be replaced with more descriptive, longer ones.
			 */
		});

		this.orderbook = null;

		if (this.options.isWS) {
			this.ws = new api.BinanceWS();

			this.ws.onDepthUpdate(this.symbol, (data) => {
				if (!this.wsReady) this.buildOrderBook();
				this.updateOrderBook(data);
			});

			/*
			 * onUserData requires an instance of BinanceRest in order to make the necessary startUserDataStream and  
			 * keepAliveUserDataStream calls
			 */
			// this.ws.onUserData(this.restAPI, (data) => {
			// 	console.log('user data', data);
			// }, 60000); // Optional, how often the keep alive should be sent in milliseconds

			setInterval(() => {
				this.buildOrderBook();
			}, 60000);
		}

		this.rest = (method, query) => {
			return new Promise((done, reject) => {
				this.restAPI[method](query, (err, data) => {
					if (err) {
						reject(err);
					} else {
						done(data);
					}
				});
			});
		};

	}

	buildOrderBook() {
		// console.log(this.GetName(), 'building order book ... ');
		return this.rest('depth', {
			symbol: this.symbol
		}).then(data => {
			if (!data || !data.bids || !data.asks) throw new Error('get Binance ' + this.symbol + ' depth error ' + JSON.stringify(data));

			this.orderbook = { Asks:{}, Bids:{}};
			data.asks.map(r => {
				this.orderbook.Asks[r[0]] = N.parse(r[1]);
			});
			data.bids.map(r => {
				this.orderbook.Bids[r[0]] = N.parse(r[1]);
			});

			return this.orderbook;
		}).catch(err => {
			console.error(this.GetName() + ' get depth error when building orderbook');
		});
	}

	updateOrderBook(data) {
		// console.log('on orderbook update');
		if (!this.orderbook) return;

		if (data.bidDepthDelta && data.bidDepthDelta.length > 0) {
			data.bidDepthDelta.map(d => {
				let q = N.parse(d.quantity);
				// console.log(d.price, d.quantity, q);
				if (q > 0) {
					this.orderbook.Bids[d.price] = q;
					Object.keys(this.orderbook.Asks).map(price => {
						if (N.parse(d.price) > N.parse(price)) this.orderbook.Asks[price] = 0;
					});
				} else {
					delete(this.orderbook.Bids[d.price]);
				}
			});
		}

		if (data.askDepthDelta && data.askDepthDelta.length > 0) {
			data.askDepthDelta.map(d => {
				let q = N.parse(d.quantity);
				// console.log(d.price, d.quantity, q);
				if (q > 0) {
					this.orderbook.Asks[d.price] = q;
					Object.keys(this.orderbook.Bids).map(price => {
						if (N.parse(d.price) < N.parse(price)) this.orderbook.Bids[price] = 0;
					});
				} else {
					delete(this.orderbook.Asks[d.price]);
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
			r.Price = N.parse(r.Price);
			return r;
		});
		bids.map(r => {
			this.orderbook.Bids[r.Price] = r.Amount;
			r.Price = N.parse(r.Price);
			return r;
		});

		this.onDepthData();
	}

	onDepthData() {
		if (!this.orderbook) return;
		if (!this.wsReady) this.wsReady = true;
		if (this.wsReadyCallback) {
			this.wsReadyCallback(true);
			delete(this.wsReadyCallback);
		}
		if (typeof this.options.onDepth === 'function') {

			let asks = Object.keys(this.orderbook.Asks).map(price => {
				return {
					Price: N.parse(price),
					Amount: N.parse(this.orderbook.Asks[price])
				};
			}).filter(d => d.Amount > 0);

			let bids = Object.keys(this.orderbook.Bids).map(price => {
				return {
					Price: N.parse(price),
					Amount: N.parse(this.orderbook.Bids[price])
				};
			}).filter(d => d.Amount > 0);

			let depth = {
				Asks: R.sort( R.ascend( R.prop('Price') ), asks),
				Bids: R.sort( R.descend( R.prop('Price') ), bids)
			};

			this.options.onDepth(depth);
		}
	}

	GetTicker() {
		return this.rest('ticker24hr', { symbol : this.symbol }).then(data => {
			return {
				Buy: N.parse(data.bidPrice),
				Sell: N.parse(data.askPrice),
				Last: N.parse(data.lastPrice),
				Time: N.parse(data.closeTime),
				High: N.parse(data.highPrice),
				Low: N.parse(data.lowPrice)
			};
		});
	}

	GetDepth(size) {
		if (!size) size = 20;
		return this.rest('depth', {
			symbol: this.symbol,
			limit: size
		}).then(data => {
			if (!data || !data.bids || !data.asks) throw new Error('get Binance ' + this.symbol + ' depth error ' + JSON.stringify(data));

			let asks = data.asks.map(r => {
				return {
					Price: N.parse(r[0]),
					Amount: N.parse(r[1])
				};
			});

			let bids = data.bids.map(r => {
				return {
					Price: N.parse(r[0]),
					Amount: N.parse(r[1])
				};
			});

			return Promise.resolve({
				Asks: R.sort( R.ascend( R.prop('Price') ), asks),
				Bids: R.sort( R.descend( R.prop('Price') ), bids)
			});
		});
	}

	GetAccount() {
		return this.rest('account').then(data => {

			if (data && data.balances) {
				let re = {
					Balance: null,
					FrozenBalance: null,
					Stocks: null,
					FrozenStocks: null
				};
				data.balances.map(r => {
					if (r.asset === this.Currency) {
						re.Stocks = N.parse(r.free);
						re.FrozenStocks = N.parse(r.locked);
					} else if (r.asset === 'USDT') {
						re.Balance = N.parse(r.free);
						re.FrozenBalance = N.parse(r.locked);
					}
				});

				if (re.Balance === null || re.FrozenBalance === null || re.Stocks === null || re.FrozenStocks === null) {
					throw new Error('binance GetAccount returns error: ' + JSON.stringify(data));
				}

				return re;
			} else {
				throw new Error('binance GetAccount return error: ' + JSON.stringify(data));
			}
		});
	}

	GetOrders() {
		/**
		 {
		   "symbol": "LTCBTC",
		   "orderId": 1,
		   "clientOrderId": "myOrder1",
		   "price": "0.1",
		   "origQty": "1.0",
		   "executedQty": "0.0",
		   "status": "NEW",
		   "timeInForce": "GTC",
		   "type": "LIMIT",
		   "side": "BUY",
		   "stopPrice": "0.0",
		   "icebergQty": "0.0",
		   "time": 1499827319559
		 }
		 */
		return this.rest('openOrders', {
			symbol: this.symbol
		}).then(orders => orders.map(o => {
			return {
				Id: o.orderId,
				Price: N.parse(o.price),
				Amount: N.parse(o.origQty),
				DealAmount: N.parse(o.executedQty),
				Type: o.side === 'BUY' ? 'Buy' : 'Sell',
				Time: N.parse(o.time),
				Status: this._order_status(o.status)
			};
		}));
	}


	GetOrder(orderId) {
		/*
		{ 
			  "symbol": "LTCBTC",
			  "orderId": 1,
			  "clientOrderId": "myOrder1",
			  "price": "0.1",
			  "origQty": "1.0",
			  "executedQty": "0.0",
			  "status": "NEW",
			  "timeInForce": "GTC",
			  "type": "LIMIT",
			  "side": "BUY",
			  "stopPrice": "0.0",
			  "icebergQty": "0.0",
			  "time": 1499827319559
		 }
		 */
		return this.rest('queryOrder', {
			symbol: this.symbol,
			orderId
		}).then(o => {
			return {
				Id: o.orderId,
				Price: N.parse(o.price),
				Amount: N.parse(o.origQty),
				DealAmount: N.parse(o.executedQty),
				Type: o.side === 'BUY' ? 'Buy' : 'Sell',
				Time: N.parse(o.time),
				Status: this._order_status(o.status)
			};
		});
	}

	_order_status(status) {
		/*
		NEW
		PARTIALLY_FILLED
		FILLED
		CANCELED
		PENDING_CANCEL
		REJECTED
		EXPIRED
		 */
		switch (status) {
				case 'NEW': 
				case 'PARTIALLY_FILLED': return 'Pending';
				case 'FILLED': return 'Closed';
				case 'CANCELED': return 'Cancelled';
				case 'PENDING_CANCEL': return 'Cancelled';
				case 'REJECTED': return 'Cancelled';
				case 'EXPIRED': return 'Cancelled';
				default: return status;
		}
	}

	Buy(price, amount) {
		ok( amount > 0, 'amount should greater than 0');
		amount = N.parse(amount, 4);
		console.log(this.GetName(), 'Buy', price, amount);

		let params = {
			symbol: this.symbol,
			side: 'BUY',
			type: price === -1 ? 'MARKET' : 'LIMIT',
			quantity: amount,
			timestamp: Date.now()
		};
		if (price > 0) {
			params.price = price;
			params.timeInForce = 'GTC';
		}

		return this.rest('newOrder', params).then( r => {
			if (r && r.orderId) return r.orderId;
			throw new Error(this.GetName() + ' sell failed ' + JSON.stringify(r));
		});
	}

	Sell(price, amount) {
		ok( amount > 0, 'amount should greater than 0');
		amount = N.parse(amount, 4);
		console.log(this.GetName(), 'Sell', price, amount);

		let params = {
			symbol: this.symbol,
			side: 'SELL',
			type: price === -1 ? 'MARKET' : 'LIMIT',
			quantity: amount,
			timestamp: Date.now()
		};
		if (price > 0) {
			params.price = price;
			params.timeInForce = 'GTC';
		}
		return this.rest('newOrder', params).then( r => {
			if (r && r.orderId) return r.orderId;
			throw new Error(this.GetName() + ' sell failed ' + JSON.stringify(r));
		});
	}

	CancelOrder(orderId) {
		return this.rest('cancelOrder', {
			symbol: this.symbol,
			orderId,
			timestamp: Date.now()
		}).then(result => {
			return !!result.clientOrderId;
		});
	}

	CancelPendingOrders() {
		console.log(this.GetName() + ' cancelling pending orders...');
		return this.GetOrders().then( orders => {
			console.log(this.GetName() + ' cancelling', orders.length, 'orders');
			return Promise.all(orders.map( o => {
				return this.CancelOrder(o.Id);
			})).then( results => {
				console.log(this.GetName(), results);
				return true;
			});
		});
	}

}


module.exports = BINANCE;
