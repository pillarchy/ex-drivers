const EXCHANGE_REST = require('./rest.js');
const EXCHANGE_WS = require('./ws.js');
const N = require('precise-number');
const { ok } = require('assert');
const DelayTrigger = require('../../lib/delay-trigger.js');
const EXCHANGE = require('../exchange.js');


class OKEX extends EXCHANGE {
	constructor(options) {
		options = Object.assign({
			Name: 'OKEX',
			Fees: {
				Maker: 0.002,
				Taker: 0.002
			},
			RateLimit: 10,
			Decimals: 8,
			StockDecimals: 3,
			MinTradeStocks: 0.0000001
		}, options);
		super(options);

		this.Currency = options.Currency;
		this.BaseCurrency = options.BaseCurrency;
		
		this.rest = new EXCHANGE_REST(this.options);
	
		if (options.isWS) {
			let wsOptions = Object.assign({}, options);
			this.delayTrigger = new DelayTrigger(300);
			if (options.onAccountChange) {
				wsOptions.onAccountChange = this.onAccountChange.bind(this);
				this.delayTrigger.on('accountChange', data => {
					options.onAccountChange(data);
				});
			}
			if (options.onTrade) wsOptions.onTrade = this.onTrade.bind(this);
			this.ws = new EXCHANGE_WS(wsOptions);
		}

		this.buildCache().catch(err => {
			console.error('okex build websocket cache failed:', err);
			process.exit();
		});
	}

	async buildCache() {
		if (this.options.isWS && this.options.onAccountChange) {
			this.wsAccountCache = await this.GetAccount();
		}
	}

	async onAccountChange(key, value) {
		if (!this.wsAccountCache) {
			await this.buildCache();
		}
		this.wsAccountCache[key] = value;
		this.delayTrigger.trigger('accountChange', this.wsAccountCache);
	}

	onTrade(o) {
		/*
		{ symbol: 'eth_btc',
		  orderId: 423541657,
		  unTrade: '0.0',
		  tradeUnitPrice: '0.05615070',
		  tradeAmount: '0.001000',
		  createdDate: '1522906129000',
		  completedTradeAmount: '0.001000',
		  averagePrice: '0.05600000',
		  tradePrice: '0.000056',
		  tradeType: 'buy',
		  status: 2 }
		 */
		if (o && this.options.onTrade) {
			this.options.onTrade({
				Id: o.orderId,
				Price: N.parse(o.tradePrice),
				AvgPrice: N.parse(o.averagePrice),
				Amount: N.parse(o.tradeAmount),
				DealAmount: N.parse(o.completedTradeAmount),
				Status: this._order_status(o.status),
				Type: this._order_type(o.tradeType),
				LeftAmount: N.parse(o.unTrade),
				UnitPrice: N.parse(o.tradeUnitPrice),
				Time: N.parse(o.createdDate)
			});
		}
	}

	waitUntilWSReady() {
		if (!this.options.isWS) return true;
		return this.ws.waitUntilWSReady();	
	}

	GetAccount() {
		return this.rest.GetAccount().then( data => {
			let base = this.options.BaseCurrency.toLowerCase();
			let currency = this.options.Currency.toLowerCase();
			return {
				Balance: N.parse(data.info.funds.free[base]),
				FrozenBalance: N.parse(data.info.funds.freezed[base]),
				Stocks: N.parse(data.info.funds.free[currency]),
				FrozenStocks: N.parse(data.info.funds.freezed[currency]),
				Info: data.info
			};
		});
	}

	GetAccounts() {
		return this.rest.GetAccount().then( data => {
			if (!data || !data.info || !data.info.funds) throw new Error('okex get account error:' + JSON.stringify(data));
			let re = {};
			let funds = data.info.funds;
			if (funds.free) {
				Object.keys(funds.free).map(c => {
					let coin = c ? c.toUpperCase() : '';
					if (!coin) return;
					if (!re[coin]) re[coin] = { Free: 0, Frozen: 0 };
					re[coin].Free = N.parse(funds.free[c]);
				});
			}

			if (funds.freezed) {
				Object.keys(funds.freezed).map(c => {
					let coin = c ? c.toUpperCase() : '';
					if (!coin) return;
					if (!re[coin]) re[coin] = { Free: 0, Frozen: 0 };
					re[coin].Frozen = N.parse(funds.freezed[c]);
				});
			}

			let arr = [];
			Object.keys(re).map(coin => {
				arr.push({
					Currency: coin,
					...re[coin]
				});
			});

			return arr;
		});
	}

	GetTicker() {
		return this.rest.GetTicker();
	}

	GetOrder(orderId) {
		return this.rest.GetOrder(orderId).then(data => {
			let orders = [];
			if (data && data.orders && data.orders.length > 0) {
				data.orders.map(o => {
					orders.push({
						Id: o.order_id,
						Price: N.parse(o.price),
						Amount: N.parse(o.amount),
						DealAmount: N.parse(o.deal_amount),
						Status: this._order_status(o.status),
						Type: this._order_type(o.type),
						AvgPrice: N.parse(o.avg_price)
					});
				});
			}
			if (orderId > 0) {
				if (orders.length > 0) {
					orders = orders[0];
				} else {
					throw orderId + ' 订单不存在';
				}
			}
			return Promise.resolve(orders);
		});
	}

	/**
	 * get finished order history
	 */
	async GetTrades(page = 1) {
		let data = await this.rest.GetTrades(page);
		let trades = [];
		if (data && data.orders) {
			data.orders.map(o => {
				trades.push({
					Id: o.order_id,
					Time: N.parse(o.create_date),
					Price: N.parse(o.price),
					Amount: N.parse(o.amount),
					DealAmount: N.parse(o.deal_amount),
					Status: this._order_status(o.status),
					Type: this._order_type(o.type),
					AvgPrice: N.parse(o.avg_price),
					Info: o
				});
			});
		}
		return trades.filter(o => o.DealAmount > 0);
	}

	Buy(price, amount) {
		ok( amount > 0, 'amount should greater than 0');
		price = N(price).round(this.options.Decimals);
		amount = N(amount).floor(this.options.StockDecimals);
		console.log(this.GetName(), 'Buy', price, amount);
		return this.rest.Buy(price, amount).then( r => {
			if (r && r.result && r.order_id) {
				return r.order_id;
			} else {
				console.log(r);
				throw new Error(r);
			}
		});
	}

	Sell(price, amount) {
		ok( amount > 0, 'amount should greater than 0');
		price = N(price).round(this.options.Decimals);
		amount = N(amount).floor(this.options.StockDecimals);
		console.log(this.GetName(), 'Sell', price, amount);
		return this.rest.Sell(price, amount).then( r => {
			if (r && r.result && r.order_id) {
				return r.order_id;
			} else {
				throw new Error(r);
			}
		});
	}

	CancelOrder(orderId) {
		return this.rest.CancelOrder(orderId).then(result => {
			if (result && (result.result === true || result.result === 'true')) return true;
			if (result && result.error_code === 1050) return true;
			if (result && result.error_code === 1009) return true;
			throw new Error('cancel order failed, result: ' + JSON.stringify(result));
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

	GetOrders() {
		return this.GetOrder(-1);
	}

	GetDepth(size, merge) {
		return this.rest.GetDepth(size, merge);
	}

	_order_status( status ) {
		//'-1:已撤销   0:未成交 1:部分成交 2:完全成交 4:撤单处理中';
		status = status.toString();
		let arr = {
			'-1':'Cancelled',
			'0': 'Pending',
			'1': 'Partial',
			'2': 'Closed',
			'4': 'Pending'
		};
		return arr[status];
	}

	_order_type( type ) {
		//buy_market:市价买入 / sell_market:市价卖出
		type = type.toString();
		let arr = {
			'buy_market':'Buy',
			'sell_market': 'Sell',
			'buy': 'Buy',
			'sell': 'Sell'
		};
		return arr[type];
	}

}


module.exports = OKEX;
