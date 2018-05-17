const N = require('precise-number');
const { ok } = require('assert');
const R = require('ramda');
const jsonic = require('jsonic');
const EXCHANGE = require('../exchange.js');

class BITTREX extends EXCHANGE {
	constructor(options) {
		options = Object.assign({
			Name: 'Bittrex',
			Fees: {
				Maker: 0.002,
				Taker: 0.002
			},
			RateLimit: 10
		}, options);
		super(options);
		this.Currency = this.options.Currency;
		this.BaseCurrency = this.options.BaseCurrency;
		this.symbol = this.BaseCurrency + '-' + this.Currency;
	
		this.bittrex = require('node-bittrex-api');
		this.bittrex.options({
			apikey: options.Key,
			apisecret: options.Secret,
			verbose: false
		});

		this.orderbook = null;

		if (this.options.isWS) {
			if (typeof this.options.onDepth !== 'function') {
				throw new Error('need onDepth callback if isWS is true');
			}

			setTimeout(() => {
				this.startWebsocket();
			}, 0);
		}

		this.rest = (method, ...args) => {
			return new Promise((done, reject) => {
				this.bittrex[method](...args, (data, err) => {
					if (err) {
						reject(err);
					} else {
						if (data && data.success) {
							done(data.result);
						} else {
							reject(data);
						}
					}
				});
			});
		};
	}


	async startWebsocket() {
		
		this.bittrex.websockets.client(client => {

			console.log('Bittrex websocket connected');

			this.wsClient = client;
			let initiated = false;
			this.bittrex.websockets.subscribe([this.symbol], data => {
			});

			let queryOrderBook = () => {
				client.call('corehub', 'QueryExchangeState', this.symbol).done((err, result) => {
					if (err) console.error(err); 
				});
			};

			client.serviceHandlers.messageReceived = (msg) => {
				try {
					let data = jsonic(msg.utf8Data);
					//console.log('>>>', data);

					if (!initiated) {
						queryOrderBook();
						setInterval(() => {
							queryOrderBook();
						}, 20000);
						initiated = true;
					}

					if (data && data.R && data.R.Buys && data.R.Sells) {
						this.buildOrderBook(data.R);
					} else if (data && data.M && Array.isArray(data.M)) {
						data.M.map(data => {
							if (data && data.M === 'updateExchangeState') {
								data.A.forEach(data_for => {
									if (data_for.MarketName === this.symbol) this.updateOrderBook(data_for);
								});
							}
						});
					}

				} catch ( err ) {}
			};

			
		});
	}

	buildOrderBook(data) {
		//console.log('build order book');
		this.orderbook = { Asks:{}, Bids:{}};
		data.Sells.map(r => {
			this.orderbook.Asks[r.Rate] = r.Quantity;
		});
		data.Buys.map(r => {
			this.orderbook.Bids[r.Rate] = r.Quantity;
		});
		return this.orderbook;
	}

	updateOrderBook(data) {
		//console.log('on orderbook update');
		if (!this.orderbook) return;

		if (data.Buys && data.Buys.length > 0) {
			data.Buys.map(d => {
				if (d.Quantity > 0) {
					this.orderbook.Bids[d.Rate] = d.Quantity;
					Object.keys(this.orderbook.Asks).map(price => {
						if (d.Rate > price) this.orderbook.Asks[price] = 0;
					});
				} else {
					delete(this.orderbook.Bids[d.Rate]);
				}
			});
		}

		if (data.Sells && data.Sells.length > 0) {
			data.Sells.map(d => {
				if (d.Quantity > 0) {
					this.orderbook.Asks[d.Rate] = d.Quantity;
					Object.keys(this.orderbook.Bids).map(price => {
						if (d.Rate < price) this.orderbook.Bids[price] = 0;
					});
				} else {
					delete(this.orderbook.Asks[d.Rate]);
				}
			});
		}

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

		this.orderbook = { Asks:{}, Bids:{}};
		asks.map(r => {
			this.orderbook.Asks[r.Price] = r.Amount;
		});
		bids.map(r => {
			this.orderbook.Bids[r.Price] = r.Amount;
		});

		let depth = {
			Asks: R.sort( R.ascend( R.prop('Price') ), asks),
			Bids: R.sort( R.descend( R.prop('Price') ), bids)
		};

		this.onDepthData(depth);
	}

	onDepthData(depth) {
		if (!this.wsReady) this.wsReady = true;
		if (typeof this.options.onDepth === 'function') {
			this.options.onDepth(depth);
		}
	}

	GetTicker() {
		return this.rest('getticker', { market : this.symbol }).then(data => {
			return {
				Buy: N.parse(data.Bid),
				Sell: N.parse(data.Ask),
				Last: N.parse(data.Last),
				Time: Date.now(),
				High: N.parse(data.Ask),
				Low: N.parse(data.Bid)
			};
		});
	}

	GetDepth(size) {
		if (!size) size = 20;
		return this.rest('getorderbook', {
			market: this.symbol,
			depth: 10,
			type: 'both'
		}).then(data => {
			if (!data || !data.buy || !data.sell) throw new Error('get bittrex ' + this.symbol + ' depth error ' + JSON.stringify(data));

			let asks = data.sell.map(r => {
				return {
					Price: N.parse(r.Rate),
					Amount: N.parse(r.Quantity)
				};
			});

			let bids = data.buy.map(r => {
				return {
					Price: N.parse(r.Rate),
					Amount: N.parse(r.Quantity)
				};
			});

			return Promise.resolve({
				Asks: R.sort( R.ascend( R.prop('Price') ), asks),
				Bids: R.sort( R.descend( R.prop('Price') ), bids)
			});
		});
	}

	GetAccount() {
		return this.rest('getbalances').then(accounts => {
			let re = {
				Balance: 0,
				FrozenBalance: 0,
				Stocks: 0,
				FrozenStocks: 0
			};
			accounts.map(account => {
				if (account.Currency === this.Currency) {
					re.Stocks = account.Available;
					re.FrozenStocks = N.minus(account.Balance, account.Available);
				}
				if (account.Currency === this.BaseCurrency) {
					re.Balance = account.Available;
					re.FrozenBalance = N.minus(account.Balance, account.Available);
				}
			});
			return re;
		});
	}

	GetOrders() {
		/**
		 {
	 		"Uuid": null,
	 		"OrderUuid": "57aadb2f-eeff-4336-9fab-397094ce9706",
	 		"Exchange": "USDT-ETH",
	 		"OrderType": "LIMIT_BUY",
	 		"Quantity": 0.1,
	 		"QuantityRemaining": 0.1,
	 		"Limit": 200,
	 		"CommissionPaid": 0,
	 		"Price": 0,
	 		"PricePerUnit": null,
	 		"Opened": "2017-09-27T14:23:53.323",
	 		"Closed": null,
	 		"CancelInitiated": false,
	 		"ImmediateOrCancel": false,
	 		"IsConditional": false,
	 		"Condition": "NONE",
	 		"ConditionTarget": null
	 	  }
		 */
		return this.rest('getopenorders', {
			market: this.symbol
		}).then(orders => orders.map(o => {
			return {
				Id: o.OrderUuid,
				Price: N.parse(o.Limit),
				Amount: N.parse(o.Quantity),
				DealAmount: N.minus(o.Quantity, o.QuantityRemaining),
				Type: o.OrderType.match(/BUY/) ? 'Buy' : 'Sell',
				Time: o.Opened,
				Status: o.Closed ? 'Closed' : 'Pending' 
			};
		}));
	}


	GetOrder(orderId) {
		/*
		{ AccountId: null,
		  OrderUuid: '57aadb2f-eeff-4336-9fab-397094ce9706',
		  Exchange: 'USDT-ETH',
		  Type: 'LIMIT_BUY',
		  Quantity: 0.1,
		  QuantityRemaining: 0.1,
		  Limit: 200,
		  Reserved: 20,
		  ReserveRemaining: 20,
		  CommissionReserved: 0.05,
		  CommissionReserveRemaining: 0.05,
		  CommissionPaid: 0,
		  Price: 0,
		  PricePerUnit: null,
		  Opened: '2017-09-27T14:23:53.323',
		  Closed: null,
		  IsOpen: true,
		  Sentinel: '8e3791aa-f233-427e-8498-4ecd35ef6b7e',
		  CancelInitiated: false,
		  ImmediateOrCancel: false,
		  IsConditional: false,
		  Condition: 'NONE',
		  ConditionTarget: null }
		 */
		return this.rest('getorder', {
			uuid: orderId
		}).then(o => {
			return {
				Id: o.OrderUuid,
				Price: N.parse(o.Limit),
				Amount: N.parse(o.Quantity),
				DealAmount: N.minus(o.Quantity, o.QuantityRemaining),
				Type: o.Type.match(/BUY/) ? 'Buy' : 'Sell',
				Time: o.Opened,
				Status: o.Closed ? 'Closed' : 'Pending'
			};
		});
	}

	Buy(price, amount) {
		ok( amount > 0, 'amount should greater than 0');
		console.log(this.GetName(), 'Buy', price, amount);
		if (price < 0) throw new Error(this.GetName() + ' does not support buy market');
		return this.rest('buylimit', {
			market: this.symbol,
			quantity: amount,
			rate: price
		}).then( r => {
			if (r && r.uuid) return r.uuid;
			throw new Error(this.GetName() + ' buy failed ' + JSON.stringify(r));
		});
	}

	Sell(price, amount) {
		ok( amount > 0, 'amount should greater than 0');
		console.log(this.GetName(), 'Sell', price, amount);
		if (price < 0) throw new Error(this.GetName() + ' does not support sell market');
		return this.rest('selllimit', {
			market: this.symbol,
			quantity: amount,
			rate: price
		}).then( r => {
			if (r && r.uuid) return r.uuid;
			throw new Error(this.GetName() + ' sell failed ' + JSON.stringify(r));
		});
	}

	CancelOrder(orderId) {
		return this.rest('cancel', {
			uuid: orderId
		}).then(result => {
			return true;
		});
	}

	CancelPendingOrders() {
		console.log('cancelling pending orders...');
		return this.GetOrders().then( orders => {
			console.log('cancelling', orders.length, 'orders');
			return Promise.all(orders.map( o => {
				return this.CancelOrder(o.Id);
			})).then( results => {
				console.log(results);
				return true;
			});
		});
	}

}


module.exports = BITTREX;
