const N = require('precise-number');
const { ok } = require('assert');
const R = require('ramda');
const moment = require('moment');
const WebSocket = require("rpc-websockets").Client;
const wait = require('delay');
const REST = require('./rest.js');
const EventEmitter = require('events');
const EXCHANGE = require('../exchange.js');
const ExError = require('../../lib/error');
const ErrorCode = require('../../lib/error-code');

class EX extends EXCHANGE {
	constructor(options) {

		options = Object.assign({
			Name: 'BITFLYER_FX',
			Fees: {
				Maker: 0,
				Taker: 0
			},
			RateLimit: 10,
			Decimals: 0,
			StockDecimals: 3,
			MinTradeStocks: 0.01,
			BaseCurrency: 'JPY',
			Currency: 'BTC',
			MarginLevel: 3
		}, options);
		super(options);

		this.Currency = options.Currency;
		this.options = options;
		this.symbol = options.Currency + '_JPY';

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

	onDepthData() {
		if (!this.orderbook) return;

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
			Asks: R.sort( R.ascend( R.prop('Price') ), asks).slice(0, 40),
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
				Buy: N.parse(data.best_bid),
				Sell: N.parse(data.best_ask),
				Last: N(data.best_bid).add(data.best_ask).div(2) * 1,
				Time: moment(data.timestamp).format('x') * 1,
				High: N.parse(data.best_ask),
				Low: N.parse(data.best_bid),
				Volume: N.parse(data.volume_by_product)
			};
		});
	}

	GetCollateral() {
		return this.rest.GetCollateral();
	}

	GetPosition() {
		/*
		[ { product_code: 'FX_BTC_JPY',
		    side: 'SELL',
		    price: 748756,
		    size: 0.01,
		    commission: 0,
		    swap_point_accumulate: 0,
		    require_collateral: 2495.8533333333335,
		    open_date: '2018-06-20T09:10:42.083',
		    leverage: 3,
		    pnl: 3.19,
		    sfd: 0 } ]
		 [ { product_code: 'FX_BTC_JPY',
		     side: 'BUY',
		     price: 748324,
		     size: 0.01,
		     commission: 0,
		     swap_point_accumulate: 0,
		     require_collateral: 2494.4133333333334,
		     open_date: '2018-06-20T09:13:42.577',
		     leverage: 3,
		     pnl: -1.06,
		     sfd: 0 } ]
		 */
		return this.rest.GetPosition().then(positions => {
			return positions.map(p => {
				let re = {
					Amount: N.parse(p.size),
					MarginLevel: N.parse(p.leverage),
					FrozenAmount: 0,
					Price: N.parse(p.price),
					Type: p.side === 'BUY' ? 'Long' : 'Short',
					ContractType: p.product_code,
					Info: p
				};
				return re;
			});
		}).then(positions => {
			if (positions.length <= 1) return positions;
			let longPosition = this._merge_position(positions, 'Long');
			let shortPosition = this._merge_position(positions, 'Short');
			let re = [];
			if (longPosition) re.push(longPosition);
			if (shortPosition) re.push(shortPosition);
			return re;
		});
	}

	async GetNetPosition() {
		let positions = await this.GetPosition();
		let re = {
			Amount: 0,
			ContractType: 'FX_BTC_JPY',
			Price: 0,
			MarginLevel: 0	
		};

		positions.map( p => {
			if (p.Type === 'Long') {
				re.Amount = p.Amount;
				re.Price = p.Price;
				re.MarginLevel = p.MarginLevel;
			} else {
				re.Amount = -1 * p.Amount;
				re.Price = p.Price;
				re.MarginLevel = p.MarginLevel;
			}
		});

		return re;
	}

	_merge_position(positions, type) {
		let arr = positions.filter(p => p.Type === type);
		if (arr.length === 1) return arr[0];
		if (arr.length === 0) return null;
		let position = {
			Type: type,
			Amount: 0,
			MarginLevel: 0,
			FrozenAmount: 0,
			Price: 0,
			ContractType: '',
			Info: []
		};
		arr.map(p => {
			position.Amount = N(p.Amount).add(position.Amount) * 1;
			position.Price = N(p.Price).multiply(p.Amount).add(position.Price) * 1;
			position.MarginLevel = p.MarginLevel;
			position.ContractType = p.ContractType;
			position.Info.push(p);
		});

		position.Price = N(position.Price).div(position.Amount).floor(0);

		return position;
	}

	async GetAccount() {
		/*
		{ collateral: 48918.872,
		  open_position_pnl: 0,
		  require_collateral: 0,
		  keep_rate: 0 }
		 */
		let info = await this.rest.GetCollateral();
		let total = info.collateral || 0;
		let totalBalance = Math.floor(total / 0.8);
		let usedBalance = Math.floor(info.require_collateral);

		return {
			Balance: Math.floor(totalBalance - usedBalance),
			FrozenBalance: usedBalance,
			Stocks: 0,
			FrozenStocks: 0,
			MarginLevel: info.keep_rate > 0 ? (N(1).div(info.keep_rate).multiply(this.options.MarginLevel) * 1) : 0,
			Info: info
		};

		// return this.rest.GetAccount().then(data => {
		// 	console.log(data);
		// 	if (data && data.length > 0) {
		// 		let re = {
		// 			Balance: null,
		// 			FrozenBalance: 0,
		// 			Stocks: null,
		// 			FrozenStocks: 0
		// 		};
		// 		data.map(r => {
		// 			if (r.currency_code === this.Currency) {
		// 				re.Stocks = N.parse(r.amount);
		// 			} else if (r.currency_code === 'JPY') {
		// 				re.Balance = N.parse(r.amount);
		// 			}
		// 		});

		// 		if (re.Balance === null || re.FrozenBalance === null || re.Stocks === null || re.FrozenStocks === null) {
		// 			throw new Error(this.GetName() + 'GetAccount returns error: ' + JSON.stringify(data));
		// 		}

		// 		return re;
		// 	} else {
		// 		throw new Error(this.GetName() + 'GetAccount return error: ' + JSON.stringify(data));
		// 	}
		// });
	}

	GetOrders() {
		/*
		[ { id: 0,
		    child_order_id: 'JFX20180620-092321-465119F',
		    product_code: 'FX_BTC_JPY',
		    side: 'SELL',
		    child_order_type: 'LIMIT',
		    price: 760550,
		    average_price: 0,
		    size: 0.01,
		    child_order_state: 'ACTIVE',
		    expire_date: '2018-07-20T09:23:20',
		    child_order_date: '2018-06-20T09:23:20',
		    child_order_acceptance_id: 'JRF20180620-092320-723852',
		    outstanding_size: 0.01,
		    cancel_size: 0,
		    executed_size: 0,
		    total_commission: 0 } ]
		 */
		return this.rest.GetOrders().then(orders => orders.map(o => this._transform_order(o)));
	}

	_transform_order(o) {
		return {
			Id: o.child_order_acceptance_id,
			Price: N.parse(o.price),
			Amount: N.parse(o.size),
			DealAmount: N.parse(o.executed_size),
			Type: o.side === 'BUY' ? 'Long' : 'Short',
			Time: moment(o.child_order_date).format('x') * 1,
			Status: this._order_status(o.child_order_state),
			ContractType: o.product_code,
			Info: o
		};
	}

	GetOrder(orderId) {
		return this.rest.GetOrders(orderId).then(orders => orders.map(o => this._transform_order(o))).then(orders => {
			if (!orders || orders.length === 0) {
				throw new ExError(ErrorCode.ORDER_NOT_FOUND, `order(${orderId}) not found`);
			}

			if (orders.length === 1) {
				return orders[0];
			} else {
				console.error(orders);
				throw new ExError(ErrorCode.UNKNOWN_ERROR, 'Bitflyer FX GetOrder returns many orders:' + JSON.stringify(orders));
			}
		});
	}

	_order_status(status) {
		/*
		ACTIVE: Return open orders
		COMPLETED: Return fully completed orders
		CANCELED: Return orders that have been cancelled by the customer
		EXPIRED: Return order that have been cancelled due to expiry
		REJECTED: Return failed orders
		 */
		switch (status) {
				case 'ACTIVE': return 'Pending';
				case 'COMPLETED': return 'Closed';
				case 'CANCELED': return 'Cancelled';
				case 'REJECTED': return 'Cancelled';
				case 'EXPIRED': return 'Cancelled';
				default: return status;
		}
	}

	Trade(type, price, amount) {
		amount = N(amount).floor(this.options.StockDecimals);
		price = N(price).floor(this.options.Decimals);

		ok( amount > 0, 'amount should greater than 0');
		ok( price > 0, 'price should greater than 0');

		console.log(this.GetName(), type, price, amount);
		return this.rest.Trade(type, price, amount);
	}

	Long(price, amount) {
		return this.Trade('Long', price, amount);
	}

	Short(price, amount) {
		return this.Trade('Short', price, amount);
	}

	CancelOrder(orderId) {
		return this.rest.CancelOrder(orderId);
	}

	CancelPendingOrders() {
		console.log(this.GetName() + ' cancelling pending orders...');
		return this.rest.CancelPendingOrders();
	}

}


module.exports = EX;
