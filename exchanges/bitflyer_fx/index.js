const N = require('precise-number');
const { ok } = require('assert');
const R = require('ramda');
const moment = require('moment');
const WebSocket = require("rpc-websockets").Client;
const wait = require('delay');
const REST = require('./rest.js');
const EventEmitter = require('events');

class EXCHANGE {
	constructor(options) {
		if (!options.Currency) options.Currency = 'BTC';
		this.Currency = options.Currency;
		this.options = options;
		this.symbol = options.Currency + '_JPY';

		this.rate = options.Rate || 0.008913331224;
	
		this.fee = {
			Maker: 0,
			Taker: 0
		};

		this.rest = new REST(this.options);

		this.wsReady = false;

		this.orderbook = null;

		this.lastDepthTime = 0;
		this.lastDepth = null;

		this.events = new EventEmitter();

		if (this.options.isWS) {
			this.ws = new WebSocket("wss://ws.lightstream.bitflyer.com/json-rpc");

			this.ws.on("open", () => {
				console.log('ws on open');
				this.ws.call("subscribe", {
					channel: "lightning_board_snapshot_FX_BTC_JPY" 
				});
				this.ws.call("subscribe", {
					channel: "lightning_board_FX_BTC_JPY" 
				});
			});

			this.ws.on("channelMessage", notify => {
				//console.log(notify);
				if (notify.channel === 'lightning_board_snapshot_FX_BTC_JPY') {
					this.buildOrderBook(notify.message);
				} else if (notify.channel === 'lightning_board_FX_BTC_JPY') {
					this.updateOrderBook(notify.message);
				} else {
					console.error('unkonwn event', notify);
				}
			});
		}
	}

	async buildOrderBook(depth) {
		if (!depth) return;
		this.orderbook = { Asks:{}, Bids:{}};
		if (depth.asks && depth.asks.length > 0) {
			depth.asks.map(r => {
				this.orderbook.Asks[r.price] = N.parse(r.size);
			});
		}
		if (depth.bids && depth.bids.length > 0) {
			depth.bids.map(r => {
				this.orderbook.Bids[r.price] = N.parse(r.size);
			});
		}
		this.wsReady = true;
		return this.orderbook;
	}

	updateOrderBook(data) {
		// console.log('on orderbook update');
		if (!this.orderbook) return;

		if (data.bids && data.bids.length > 0) {
			data.bids.map(d => {
				let q = N.parse(d.size);
				// console.log(d.price, d.size, q);
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

		if (data.asks && data.asks.length > 0) {
			data.asks.map(d => {
				let q = N.parse(d.size);
				// console.log(d.price, d.size, q);
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


	async waitUntilWSReady() {
		let startTime = Date.now();
		while (true) {
			if (Date.now() - startTime > 30000) throw new Error('bitflyer websocket ready timeout');
			if (!this.wsReady) {
				await wait(200);
			} else {
				break;
			}
		}
		return true;
	}


	onDepthData() {
		if (!this.orderbook) return;

		let asks = Object.keys(this.orderbook.Asks).map(price => {
			return {
				Price: N(price).multiply(this.rate).floor(2) * 1,
				Amount: N.parse(this.orderbook.Asks[price])
			};
		}).filter(d => d.Amount > 0);

		let bids = Object.keys(this.orderbook.Bids).map(price => {
			return {
				Price: N(price).multiply(this.rate).floor(2) * 1,
				Amount: N.parse(this.orderbook.Bids[price])
			};
		}).filter(d => d.Amount > 0);

		let depth = {
			Asks: R.sort( R.descend( R.prop('Price') ), asks).slice(-40),
			Bids: R.sort( R.descend( R.prop('Price') ), bids).slice(0, 40)
		};

		if (typeof this.options.onDepth === 'function') {
			this.options.onDepth(depth);
		}

		this.lastDepth = depth;
		this.lastDepthTime = Date.now();
		this.events.emit('depth', depth);
	}

	GetDepth() {
		if (this.isWS && this.wsReady) {
			if (Date.now() - this.lastDepthTime < 10 && this.lastDepth) {
				return Promise.resolve(this.lastDepth);
			}
			return new Promise(done => {
				this.events.once('depth', d => done(d));
			});
		} else {
			return this.rest.GetDepth();
		}
	}

	GetFee() {
		return this.fee;
	}

	GetName() {
		return this.options.Name ? this.options.Name : 'Bitflyer';
	}

	GetTicker() {
		/*
		{ product_code: 'BTC_JPY',
		  timestamp: '2017-10-10T13:49:30.187',
		  tick_id: 13257531,
		  best_bid: 537178,
		  best_ask: 537345,
		  best_bid_size: 2e-7,
		  best_ask_size: 0.00976006,
		  total_bid_depth: 4636.9179559,
		  total_ask_depth: 1793.25003469,
		  ltp: 537346,
		  volume: 203079.27801949,
		  volume_by_product: 23606.46619995 }
		 */
		return this.rest.GetTicker().then(data => {
			return {
				Buy: N(data.best_bid).multiply(this.rate).floor(2),
				Sell: N(data.best_ask).multiply(this.rate).floor(2),
				Last: N(data.best_bid).add(data.best_ask).div(2).multiply(this.rate).floor(2),
				Time: moment(data.timestamp).format('x') * 1,
				High: N(data.best_ask).multiply(this.rate).floor(2),
				Low: N(data.best_bid).multiply(this.rate).floor(2),
				Volume: N.parse(data.volume_by_product)
			};
		});
	}

	GetCollateral() {
		return new Promise((done, reject) => {
			this.rest.getCollateral((err, data) => {
				if (err)
				{reject(err);}
				else
				{done(data);}
			});
		}).then(data => {
			return data;
		});
	}

	GetPosition() {
		return this.rest.GetPosition();
	}

	GetAccount() {
		return this.rest.GetAccount().then(data => {
			console.log(data);
			if (data && data.length > 0) {
				let re = {
					Balance: null,
					FrozenBalance: 0,
					Stocks: null,
					FrozenStocks: 0
				};
				data.map(r => {
					if (r.currency_code === this.Currency) {
						re.Stocks = N.parse(r.amount);
						// re.FrozenStocks = N(r.amount).minus(r.available)*1;
					} else if (r.currency_code === 'JPY') {
						re.Balance = N(r.amount).multiply(this.rate).floor(2) * 1;
						// re.FrozenBalance = N(r.amount).minus(r.available).multiply(this.rate).floor(2)*1;
					}
				});

				if (re.Balance === null || re.FrozenBalance === null || re.Stocks === null || re.FrozenStocks === null) {
					throw new Error(this.GetName() + 'GetAccount returns error: ' + JSON.stringify(data));
				}

				return re;
			} else {
				throw new Error(this.GetName() + 'GetAccount return error: ' + JSON.stringify(data));
			}
		});
	}

	GetOrders() {
		return this.rest.GetOrders();
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

	GetMin() {
		return 0.01;
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


module.exports = EXCHANGE;
