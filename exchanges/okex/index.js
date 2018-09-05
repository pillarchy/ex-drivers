const EXCHANGE_REST = require('./rest.js');
const EXCHANGE_WS = require('./ws.js');
const N = require('precise-number');
const { ok } = require('assert');
const EXCHANGE = require('../exchange.js');
const ExError = require('../../lib/error');
const ErrorCode = require('../../lib/error-code');
const fetch = require('node-fetch');

class OKEX extends EXCHANGE {
	constructor(options) {
		options = Object.assign({
			Name: 'OKEX',
			Fees: {
				Maker: 0.002,
				Taker: 0.002
			},
			RateLimit: 10
		}, options);
		super(options);

		this.rest = new EXCHANGE_REST(this.options);
	
		if (options.isWS) {
			this.ws = new EXCHANGE_WS(options);
			this.ws.on('connect', () => {
				this.wsReady = true;
			});
			this.ws.on('close', () => {
				this.wsReady = false;
			});
		}
	}

	async Subscribe(currency, baseCurrency, type) {
		if (!this.options.isWS) throw new Error('is not websocket mode');
		if (['Depth', 'PublicTrades', 'Ticker'].indexOf(type) === -1) {
			throw new Error('unkown subscription type: ' + type);
		}

		if (type === 'Depth' && !this.options.onDepth) throw new Error('no onDepth callback');
		if (type === 'Ticker' && !this.options.onTicker) throw new Error('no onTicker callback');
		if (type === 'PublicTrades' && !this.options.onPublicTrades) throw new Error('no onPublicTrades callback');

		try {
			await this.waitUntilWSReady();
			await this.ws.addSubscription(currency, baseCurrency, type);
		} catch (err) {
			console.error(this.GetName() + ` Subscribe got error:`, err);
			throw err;
		}
	}

	GetAccount(Currency, BaseCurrency) {
		return this.rest.GetAccount().then( data => {
			let base = (BaseCurrency || this.options.BaseCurrency).toLowerCase();
			let currency = (Currency || this.options.Currency).toLowerCase();
			return {
				Balance: N.parse(data.info.funds.free[base]),
				FrozenBalance: N.parse(data.info.funds.freezed[base]),
				Stocks: N.parse(data.info.funds.free[currency]),
				FrozenStocks: N.parse(data.info.funds.freezed[currency]),
				...this.rest._parse_ch(this.rest._getSymbol(Currency, BaseCurrency)),
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

	GetTicker(Currency, BaseCurrency) {
		return this.rest.GetTicker(Currency, BaseCurrency);
	}

	GetOrder(orderId, Currency, BaseCurrency) {
		return this.rest.GetOrder(orderId, Currency, BaseCurrency).then(data => {
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
						AvgPrice: N.parse(o.avg_price),
						Time: N.parse(o.create_date),
						...this.rest._parse_ch(this.rest._getSymbol(Currency, BaseCurrency)),
						Info: o
					});
				});
			}
			if (orderId > 0) {
				if (orders.length > 0) {
					orders = orders[0];
				} else {
					throw new ExError(ErrorCode.ORDER_NOT_FOUND,  `okex order(${orderId}) not found`);
				}
			}
			return Promise.resolve(orders);
		});
	}

	/**
	 * get finished order history
	 */
	async GetTrades(Currency, BaseCurrency, page = 1) {
		let data = await this.rest.GetTrades(Currency, BaseCurrency, page);
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
					...this.rest._parse_ch(o.symbol),
					Info: o
				});
			});
		}
		return trades.filter(o => o.DealAmount > 0);
	}

	async GetPublicTrades(Currency, BaseCurrency, since) {
		let data = await this.rest.GetPublicTrades(Currency, BaseCurrency, since);
		let trades = [];
		if (data && data.length > 0) {
			data.map(o => {
				trades.push({
					Id: o.tid,
					Time: N.parse(o.date_ms),
					Price: N.parse(o.price),
					Amount: N.parse(o.amount),
					Type: this._order_type(o.type),
					...this.rest._parse_ch(this.rest._getSymbol(Currency, BaseCurrency))
				});
			});
		};
		return trades;
	}

	Trade(type, price, amount, Currency, BaseCurrency) {
		ok( amount > 0, 'amount should greater than 0');
		if (this.options.Decimals) price = N(price).round(this.options.Decimals);
		if (this.options.StockDecimals) amount = N(amount).floor(this.options.StockDecimals);
		console.log(this.GetName(), type, price, amount, Currency || this.options.Currency, BaseCurrency || this.options.BaseCurrency);
		return this.rest.Trade(type, price, amount, Currency, BaseCurrency).then( r => {
			if (r && r.result && r.order_id) {
				return r.order_id;
			} else {
				console.log(r);
				throw new Error(r);
			}
		});
	}

	Buy(...args) {
		return this.Trade('Buy', ...args);
	}

	Sell(...args) {
		return this.Trade('Sell', ...args);	
	}

	CancelOrder(orderId, Currency, BaseCurrency) {
		return this.rest.CancelOrder(orderId, Currency, BaseCurrency).then(result => {
			if (result && (result.result === true || result.result === 'true')) return true;
			if (result && result.error_code === 1050) return true;
			if (result && result.error_code === 1009) return true;
			throw new Error('cancel order failed, result: ' + JSON.stringify(result));
		});
	}

	CancelPendingOrders(Currency, BaseCurrency) {
		console.log('cancelling pending orders...');
		return this.GetOrders(Currency, BaseCurrency).then( orders => {
			console.log('cancelling', orders.length, 'orders');
			return Promise.all(orders.map( o => {
				return this.CancelOrder(o.Id, Currency, BaseCurrency);
			})).then( results => {
				console.log(results);
				return true;
			});
		});
	}

	GetOrders(Currency, BaseCurrency) {
		return this.GetOrder(-1, Currency, BaseCurrency);
	}

	GetDepth(Currency, BaseCurrency, size, merge) {
		return this.rest.GetDepth(Currency, BaseCurrency, size, merge);
	}

	_order_status( status ) {
		//-1:已撤销  0:未成交  1:部分成交  2:完全成交 3:撤单处理中
		status = status.toString();
		let arr = {
			'-1':'Cancelled',
			'0': 'Pending',
			'1': 'Partial',
			'2': 'Closed',
			'3': 'Pending',
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

	GetMarkets() {
		return fetch('https://www.okex.com/v2/spot/markets/products').then(res => res.json()).then(obj => {
			let arr = obj ? obj.data : [];
			let re = [];
			arr.map(m => {
				if (!m || !m.symbol || m.symbol.match(/test[abc]/)) return;
				let [Currency, BaseCurrency] = m.symbol.toUpperCase().split('_');
				let Decimals = m.maxPriceDigit;
				let StockDecimals = m.maxSizeDigit;
				let MinTradeAmount = m.minTradeSize;
				re.push({
					Currency,
					BaseCurrency,
					Decimals,
					StockDecimals,
					MinTradeAmount
				});
			});
			return re;
		});
	}

}


module.exports = OKEX;
