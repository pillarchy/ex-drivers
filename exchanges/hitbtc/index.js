const N = require('precise-number');
const { ok, equal } = require('assert');
const R = require('ramda');
const moment = require('moment');
const HitBTC = require('hitbtc-api').default;
const ExName = 'HitBTC';
const WebSocket = require('../../lib/auto-reconnect-ws.js');
const WS = require('ws');
const debug = require('debug')('exchange:hitbtc:rest');
const debugWS = require('debug')('exchange:hitbtc:ws');

class EXCHANGE {
	constructor(options) {
		debug('new instance with options', options);
		if (!options.Currency) options.Currency = 'BTC';
		this.Currency = options.Currency;
		this.options = options;
		this.symbol = options.Currency+'USD';

		this.fee = {
			BuyMaker: 0.1,
			SellMaker: 0.1,
			BuyTaker: 0.1,
			SellTaker: 0.1
		};

		this.rest = new HitBTC({
			key: options.Key,
			secret: options.Secret,
			isDemo: false
		});

		this.wsReady = false;

		this.orderbook = null;

		if (this.options.isWS) {
			debugWS('starting websocket');
			this.ws = new WebSocket('wss://st.hitbtc.com/');

			this.ws.on('open', ()=>{
				debugWS('connected');
				if (this.orderbookTimer) clearInterval(this.orderbookTimer);
				this.ws.send('[1,"orderbook","'+this.symbol+'"]');

				this.orderbookTimer = setInterval(()=>{
					this.ws.send('[1,"orderbook","'+this.symbol+'"]');
				}, 60000);
			});

			this.ws.on('message', s=>{
				try {
					let [code, type, symbol, data] = JSON.parse(s);
					if (type === 'orderbook') {
						let total = data.ask.length + data.bid.length;
						if (total > 300) {
							this.buildOrderBook(data);
						} else {
							this.updateOrderBook(data);
						}
						//console.log('order book got', 'bids = '+data.bid.length, 'asks = '+data.ask.length);
					}
				} catch( err ) {}
			});

			if (this.options.onPong) {
				this.ws.on('pong', (t)=>{
					//console.log('pong', t+'ms');
					this.options.onPong(t);
				});
			}
		}

	}

	buildOrderBook(data) {
		if (!data || !data.bid || !data.ask) return;
		debugWS('build order book');
		this.orderbook = { Asks:{}, Bids:{}};
		data.ask.map(r=>{
			this.orderbook.Asks[r[0]] = N.parse(r[1]);
		});
		data.bid.map(r=>{
			this.orderbook.Bids[r[0]] = N.parse(r[1]);
		});
		// this.onDepthData();
		return this.orderbook;
	}

	updateOrderBook(data) {
		debugWS('update order book');
		// console.log('on orderbook update');
		if (!this.orderbook) return;

		if (data.bid && data.bid.length > 0) {
			data.bid.map(d => {
				let q = N.parse(d[1]);
				// console.log(d[0], d[1], q);
				if (q > 0) {
					this.orderbook.Bids[d[0]] = q;
					Object.keys(this.orderbook.Asks).map(price => {
						if (N.parse(d[0]) > N.parse(price)) this.orderbook.Asks[price] = 0;
					});
				} else {
					delete(this.orderbook.Bids[d[0]]);
				}
			});
		}

		if (data.ask && data.ask.length > 0) {
			data.ask.map(d => {
				let q = N.parse(d[1]);
				// console.log(d[0], d[1], q);
				if (q > 0) {
					this.orderbook.Asks[d[0]] = q;
					Object.keys(this.orderbook.Bids).map(price => {
						if (N.parse(d[0]) < N.parse(price)) this.orderbook.Bids[price] = 0;
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
			}
		}).filter(d=>d.Amount > 0);

		let bids = Object.keys(this.orderbook.Bids).map(price => {
			return {
				Price: price,
				Amount: N.parse(this.orderbook.Bids[price])
			}
		}).filter(d=>d.Amount > 0);

		this.orderbook = { Asks:{}, Bids:{}};
		asks.map(r=>{
			this.orderbook.Asks[r.Price] = r.Amount;
		});
		bids.map(r=>{
			this.orderbook.Bids[r.Price] = r.Amount;
		});

		this.onDepthData();
	}


	waitUntilWSReady() {
		// console.log('waiting...');
		return new Promise((done, reject) => {
			this.wsReadyCallback = done;
			setTimeout(()=>{
				debugWS('waitUntilWSReady timeout');
				delete(this.wsReadyCallback);
				reject();
			}, 30000);
		});
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
				}
			}).filter(d=>d.Amount > 0);

			let bids = Object.keys(this.orderbook.Bids).map(price => {
				return {
					Price: N.parse(price),
					Amount: N.parse(this.orderbook.Bids[price])
				}
			}).filter(d=>d.Amount > 0);

			let depth = {
				Asks: R.sort( R.descend( R.prop('Price') ), asks).slice(-20),
				Bids: R.sort( R.descend( R.prop('Price') ), bids).slice(0,20)
			};

			this.options.onDepth(depth);
		}
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
		return this.options.Name ? this.options.Name : ExName;
	}

	GetTicker() {
		/*
		{ ask: '4779.38',
		  bid: '4770.02',
		  last: '4775.96',
		  low: '4714.91',
		  high: '4932.90',
		  open: '4838.94',
		  volume: '1572.69',
		  volume_quote: '7561866.0823',
		  timestamp: 1507730872513 }
		 */
		return this.rest.getTicker(this.symbol).then(data => {
			return {
				Buy: N.parse(data.bid),
				Sell: N.parse(data.ask),
				Last: N.parse(data.last),
				Time: N.parse(data.timestamp),
				High: N.parse(data.high),
				Low: N.parse(data.low),
				Volume: N.parse(data.volume)
			};
		})
	}

	GetDepth() {
		debug('GetDepth');
		return this.rest.getOrderBook(this.symbol).then(data=>{
			debug('GetDepth', data);
			if (!data || !data.bids || !data.asks) throw new Error(this.GetName()+' depth error '+JSON.stringify(data));

			let asks = data.asks.map(r=>{
				return {
					Price: N.parse(r.price),
					Amount: N.parse(r.volume)
				}
			});

			let bids = data.bids.map(r=>{
				return {
					Price: N.parse(r.price),
					Amount: N.parse(r.volume)
				}
			});

			return Promise.resolve({
				Asks: R.sort( R.descend( R.prop('Price') ), asks).slice(-20),
				Bids: R.sort( R.descend( R.prop('Price') ), bids).slice(0, 20)
			});
		});
	}

	GetAccount() {
		/*
		{ balance: 
		   { '1ST': { currency_code: '1ST', cash: '0', reserved: '0' },
		     '8BT': { currency_code: '8BT', cash: '0', reserved: '0' },
		     ADX: { currency_code: 'ADX', cash: '0', reserved: '0' },
		     AE: { currency_code: 'AE', cash: '0', reserved: '0' },
		     AEON: { currency_code: 'AEON', cash: '0', reserved: '0' },
		     ...
		   }
		}
		 */
		debug('GetAccount');
		return this.rest.getMyBalance().then(data=>{
			debug('GetAccount', data);
			if (data && data.balance) {
				let re = {
					Balance: N.parse(data.balance['USD'].cash),
					FrozenBalance: N.parse(data.balance['USD'].reserved),
					Stocks: N.parse(data.balance[this.Currency].cash),
					FrozenStocks: N.parse(data.balance[this.Currency].reserved)
				};
				return re;
			} else {
				throw new Error(this.GetName() + 'GetAccount return error: '+JSON.stringify(data));
			}
		});
	}

	GetOrders(clientOrderId) {
		/**
		{"orders": [
		  {
		    "orderId": "51521638",
		    "orderStatus": "new",
		    "lastTimestamp": 1394798401494,
		    "orderPrice": 1000,
		    "orderQuantity": 1,
		    "avgPrice": 0,
		    "quantityLeaves": 1,
		    "type": "limit",
		    "timeInForce": "GTC",
		    "cumQuantity": 0,
		    "clientOrderId": "7fb8756ec8045847c3b840e84d43bd83",
		    "symbol": "LTCBTC",
		    "side": "sell",
		    "execQuantity": 0
		  }
		]}
		 */
		debug('GetOrders', clientOrderId);
		let params = {
			symbols: this.symbol
		};
		if (clientOrderId) params.clientOrderId = clientOrderId;

		return this.rest.getMyActiveOrders(params).then(data => {
			debug('GetOrders', data);
			if (!data || !data.orders) throw new Error(this.GetName() + ' GetOrders() returns bad data '+JSON.stringify(data));
			return data.orders.map(o=> {
				return {
					Id: o.clientOrderId,
					Price: N.parse(o.orderPrice),
					Amount: N(o.orderQuantity).div(100)*1,
					DealAmount: N(o.execQuantity).div(100)*1,
					Type: o.side === 'buy' ? 'Buy' : 'Sell',
					Time: N.parse(o.lastTimestamp),
					Status: this._order_status(o.orderStatus)
				};
			});
		});
	}


	GetOrder(orderId) {
		debug('GetOrder', orderId);
		return this.GetOrders(orderId).then(orders=>{
			debug('GetOrder, first get all orders', orders);
			for(let i=0;i<orders.length;i++) {
				if (orders[i].Id == orderId) return orders[i];
			}
			return null;
		});
	}

	_order_status(status) {
		/*
		new 
		partiallyFilled 
		filled 
		canceled 
		rejected 
		expired
		 */
		switch(status) {
			case 'new': 
			case 'partiallyFilled': return 'Pending';
			case 'filled': return 'Closed';
			case 'canceled': return 'Cancelled';
			case 'rejected': return 'Cancelled';
			case 'expired': return 'Cancelled';
			default: return status;
		}
	}

	_trade(side, price, amount) {
		/*
		{ "ExecutionReport": 
		   { "orderId": "58521038",
		     "clientOrderId": "11111112",
		     "execReportType": "new",
		     "orderStatus": "new",
		     "symbol": "BTCUSD",
		     "side": "buy",
		     "timestamp": 1395236779235,
		     "price": 0.1,
		     "quantity": 100,
		     "type": "limit",
		     "timeInForce": "GTC",
		     "lastQuantity": 0,
		     "lastPrice": 0,
		     "leavesQuantity": 100,
		     "cumQuantity": 0,
		     "averagePrice": 0 } }
		 */
		
		let params = {
			clientOrderId: 'bot'+Date.now()+ Math.floor(1000, Math.random()*9000),
			symbol: this.symbol,
			side,
			price: N(price).floor(2)*1,
			quantity: N(amount).multiply(100).floor(0)*1,
			type: 'limit',
			timeInForce: 'GTC'
		};
		
		if (price === -1) {
			params.type = 'market';
			delete(params.price);
			params.timeInForce = 'IOC';
		}
		debug('_trade', params);
		return this.rest.placeOrder(params).then(data=>{
			debug('_trade result', data);
			let result = data.ExecutionReport;
			if (data && result) return result.clientOrderId;
			throw new Error(this.GetName()+' new order failed: '+JSON.stringify(data));
		});
	}

	GetMin() {
		return 0.01;
	}

	Buy(price, amount) {
		amount = N.parse(amount, 2);
		ok( amount > 0, 'amount should greater than 0');
		console.log(this.GetName(), 'Buy', price, amount);

		return this._trade('buy', price, amount);
	}

	Sell(price, amount) {
		amount = N.parse(amount, 2);
		ok( amount > 0, 'amount should greater than 0');
		console.log(this.GetName(), 'Sell', price, amount);

		return this._trade('sell', price, amount);
	}

	CancelOrder(orderId) {
		/*
		{ "ExecutionReport": 
		   { "orderId": "58521038",
		     "clientOrderId": "11111112",
		     "execReportType": "canceled",
		     "orderStatus": "canceled",
		     "symbol": "BTCUSD",
		     "side": "buy",
		     "timestamp": 1395236779346,
		     "price": 0.1,
		     "quantity": 100,
		     "type": "limit",
		     "timeInForce": "GTC",
		     "lastQuantity": 0,
		     "lastPrice": 0,
		     "leavesQuantity": 0,
		     "cumQuantity": 0,
		     "averagePrice": 0 } }
		 */
		debug('CancelOrder', orderId);
		return this.rest.cancelOrder({
			clientOrderId: orderId
		}).then(result=>{
			debug('CancelOrder result', result);
			return !!(result && result.ExecutionReport && result.ExecutionReport.orderStatus == 'canceled');
		});
	}

	CancelPendingOrders() {
		console.log(this.GetName()+' cancelling pending orders...');
		debug('CancelPendingOrders');
		return this.rest.cancelAllOrders({
			symbols: this.symbol
		}).then( data => {
			debug('CancelPendingOrders', data);
			if (data && data.ExecutionReport) {
				return data.ExecutionReport.map(o=>{
					return o.orderStatus == 'canceled';
				});
			} else {
				throw new Error(this.GetName() + ' CancelPendingOrders error: '+ JSON.stringify(data));
			}
		});
	}

}


module.exports = EXCHANGE;
