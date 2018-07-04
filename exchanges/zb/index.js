const WS = require('./ws.js');
const REST = require('./rest.js');
const N = require('precise-number');
const R = require('ramda');
const debug = require('debug')('exchange:zb');
const EXCHANGE = require('../exchange.js');
const ExError = require('../../lib/error');
const ErrorCode = require('../../lib/error-code');

class ZB extends EXCHANGE {
	constructor(options) {
		options = Object.assign({
			Name: 'ZB',
			Fees: {
				Taker: 0.002,
				Maker: 0.002
			},
			RateLimit: 15,
			MinTradeAmount: 0.001,
			DefaultDepthSize: 50,
			Currency: 'BTC',
			BaseCurrency: 'QC'
		}, options);
		super(options);

		if (this.options.isWS) {
			this.ws = new WS(this.options);
			this.ws.on('connect', () => {
				this.wsReady = true;
			});
			this.ws.on('close', () => {
				this.wsReady = false;
			});
		}

		this.rest = new REST(this.options);
	}

	getHandler() {
		return (this.options.isWS && this.wsReady) ? this.ws : this.rest;
	}

	async Subscribe(currency, baseCurrency, type) {
		if (!this.options.isWS) throw new Error('is not websocket mode');
		if (['Depth', 'PublicTrades', 'Ticker'].indexOf(type) === -1) {
			throw new Error('unkown subscription type: ' + type);
		}

		if (type === 'Depth' && !this.options.onDepth) throw new Error('no onDepth callback');
		if (type === 'Ticker' && !this.options.onTicker) throw new Error('no onTicker callback');
		if (type === 'PublicTrades' && !this.options.onPublicTrades) throw new Error('no onPublicTrades callback');

		if (type === 'PublicTrades') type = 'trades';

		try {
			await this.ws.waitUntilWSReady();
			await this.ws.addSubscription(currency, baseCurrency, type);
		} catch (err) {
			console.error(this.GetName() + ` Subscribe got error:`, err);
			throw err;
		}
	}

	GetAccount(Currency = '', BaseCurrency = '') {
		if (!Currency) Currency = this.options.Currency;
		if (!BaseCurrency) BaseCurrency = this.options.BaseCurrency;
		return this.getHandler().GetAccount().then(data => {
			if (!data.coins) throw new Error("zb GetAccount result error: " + JSON.stringify(data));
			let re = {
				Balance: 0,
				FrozenBalance: 0,
				Stocks: 0,
				FrozenStocks: 0,
				Currency,
				BaseCurrency,
			};
			data.coins.map(a => {
				if (a.key === BaseCurrency.toLowerCase()) {
					re.Balance = N.parse(a.available);
					re.FrozenBalance = N.parse(a.freez);
				} else if (a.key.toUpperCase() === Currency) {
					re.Stocks = N.parse(a.available);
					re.FrozenStocks = N.parse(a.freez);
				}

				if (a.key === 'zb') {
					re.ZB = N.parse(a.available);
					re.FrozenZB = N.parse(a.freez);
				}

				if (a.key === 'usdt') {
					re.USDT = N.parse(a.available);
					re.FrozenUSDT = N.parse(a.freez);
				}

				if (a.key === 'qc') {
					re.QC = N.parse(a.available);
					re.FrozenQC = N.parse(a.freez);
				}
			});
			re.Info = data;
			return re;
		});
	}

	GetAccounts() {
		return this.getHandler().GetAccount().then(data => {
			if (!data.coins) throw new Error("zb GetAccount result error: " + JSON.stringify(data));
			let re = [];
			data.coins.map(a => {
				re.push({
					Currency: String(a.key).toUpperCase(),
					Free: N.parse(a.available),
					Frozen: N.parse(a.freez),
					Info: a
				});
			});
			return re;
		});
	}

	async GetTicker(Currency = '', BaseCurrency = '') {
		if (!Currency) Currency = this.options.Currency;
		if (!BaseCurrency) BaseCurrency = this.options.BaseCurrency;

		let data = await this.rest.GetTicker(Currency, BaseCurrency);
		if (!data.ticker) throw new Error('get ticker returns bad data: ' + JSON.stringify(data));
		let t = data.ticker;
		let Time = N.parse(data.date || Date.now());
		return {
			Buy: N.parse(t.buy),
			Sell: N.parse(t.sell),
			High: N.parse(t.high),
			Last: N.parse(t.last),
			Low: N.parse(t.low),
			Volume: N.parse(t.vol),
			Time,
			Currency,
			BaseCurrency,
			Info: data
		};
	}

	Trade(type, price, amount, Currency = '', BaseCurrency = '') {
		if (this.options.Decimals) price = N(price).round(this.options.Decimals);
		if (this.options.StockDecimals) amount = N(amount).floor(this.options.StockDecimals);
		console.log(this.GetName(), type, price, amount, Currency, BaseCurrency);
		if (!price || price <= 0) throw new ExError(ErrorCode.WRONG_INPUT, 'price should greater than 0');
		if (!amount || amount <= 0) throw new ExError(ErrorCode.WRONG_INPUT, 'amount should greater than 0');

		return this.getHandler().Trade(type, price, amount, Currency, BaseCurrency).then(id => {
			return id;
		}).catch(err => {
			if (err && err.code === 2009) {
				throw new ExError(ErrorCode.INSUFFICIENT_BALANCE, err.message, err);
			}
			throw err;
		});
	}

	Buy(price, amount, Currency = '', BaseCurrency = '') {
		return this.Trade('Buy', price, amount, Currency, BaseCurrency);
	}

	Sell(price, amount, Currency = '', BaseCurrency = '') {
		return this.Trade('Sell', price, amount, Currency, BaseCurrency);
	}

	CancelOrder(orderId, Currency = '', BaseCurrency = '') {
		return this.getHandler().CancelOrder(orderId, Currency, BaseCurrency).then(result => {
			return result;
		}).catch(err => {
			if (err && err.code === 3001) {
				return true;
			}
			throw err;
		});
	}

	async CancelPendingOrders(Currency, BaseCurrency) {
		return this.GetOrders(Currency, BaseCurrency).then(arr => {
			// console.log('got pending order from api:', arr);
			if (!arr) return [];
			return arr.filter(o => (o.Status === 'Pending' || o.Status === 'Partial'));
		}).then(async orders => {
			let re = {};
			if (orders && orders.length > 0) {
				debug('cancelling ', orders.length, 'orders');
				for (let i = 0; i < orders.length; i++) {
					re[orders[i].Id] = await this.CancelOrder(orders[i].Id, Currency, BaseCurrency);
				}
			}
			return re;
		});
	}

	GetOrders(Currency, BaseCurrency) {
		return this.rest.GetOrders(Currency, BaseCurrency).then(arr => {
			if (arr === undefined) {
				console.error('GetOrders got undefined');
				return [];
			}
			arr = arr.map(o => this._transform_order(o));
			arr = R.sort( R.ascend( R.prop('Time') ), arr);
			return arr;
		}).catch(err => {
			if (err.code === 3001) return [];
			throw err;
		});	
	}

	async GetTrades(Currency, BaseCurrency, page = 1, pageSize = 100) {
		if (!Currency) Currency = this.options.Currency;
		if (!BaseCurrency) BaseCurrency = this.options.BaseCurrency;

		let trades = await this.rest.GetTrades(page, pageSize, Currency, BaseCurrency);
		trades = trades.map( t => {
			t = this._transform_order(t);
			t.AvgPrice = t.Price;
			return t;
		});
		trades = R.sort( R.ascend( R.prop('Time') ), trades);
		return trades.filter(o => (o.Status === 'Closed' || o.Status === 'Cancelled') && o.DealAmount > 0);
	}

	GetOrder(orderId, Currency, BaseCurrency) {
		return this.getHandler().GetOrder(orderId, Currency, BaseCurrency).then(o => {
			return this._transform_order(o);
		}).catch(err => {
			if (err && err.type === 'request-timeout') throw `getOrder(${orderId}) timed out`;
			if (err && err.code === 3001) throw new ExError(ErrorCode.ORDER_NOT_FOUND, `order(${orderId}) not found`, err);
			throw err;
		});
	}

	_transform_order(o) {
		/*
		{ currency: 'btcusdt',
		    id: '201712127040792',
		    price: '13000.0',
		    status: '0',
		    total_amount: '0.01',
		    trade_amount: '0.0',
		    trade_date: '1513063121871',
		    trade_money: '0.000000',
		    trade_price: '0',
		    type: '1' },
		 */
		function _order_status(o) {
			//(0：待成交,1：取消,2：交易完成,3：待成交未交易部份)
			switch (o) {
					case 0: return 'Pending';
					case 1: return 'Cancelled';
					case 2: return 'Closed';
					case 3: return 'Partial';
					default: return 'Unknown';
			}
		}

		let Currency = this.options.Currency;
		let BaseCurrency = this.options.BaseCurrency;
		if (o.currency && /^\w+\_\w+$/.test(o.currency)) {
			let arr = o.currency.split('_');
			Currency = String(arr[0]).toUpperCase();
			BaseCurrency = String(arr[1]).toUpperCase();
		} else if (o.currency && String(o.currency).match(/(zb|usdt|qc|btc|eth)$/i)) {
			let ms = o.currency.match(/(zb|usdt|qc|btc|eth)$/i);
			if (ms && ms[1]) {
				BaseCurrency = String(ms[1]).toUpperCase();
				Currency = o.currency.replace(ms[1], '').toUpperCase();
			}
		}

		let re = {
			Id: o.id,
			Price: N.parse(o.price),
			Amount: N.parse(o.total_amount),
			DealAmount: N.parse(o.trade_amount),
			AvgPrice: o.trade_money / o.trade_amount,
			Type: (o.type && o.type * 1 === 1) ? 'Buy' : 'Sell',
			Time: N.parse(o.trade_date),
			Status: _order_status(o.status * 1),
			Currency,
			BaseCurrency,
			Info: o
		};

		if (re.DealAmount === 0 && re.Status === 'Partial') re.Status = 'Pending';
		return re;
	}

	GetDepth(Currency, BaseCurrency, size, merge) {
		if (!size && this.options.DefaultDepthSize) size = this.options.DefaultDepthSize;
		if (!merge && this.options.DefaultDepthMerge) merge = this.options.DefaultDepthMerge;
		return this.rest.GetDepth(Currency, BaseCurrency, size, merge);
	}

}

module.exports = ZB;
