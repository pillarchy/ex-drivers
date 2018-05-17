const WS = require('./ws.js');
const REST = require('./rest.js');
const N = require('precise-number');
const debug = require('debug')('exchange:zb');
const RateLimit = require('../../lib/rate-limit');
const EXCHANGE = require('../exchange.js');

class ZB extends EXCHANGE {
	constructor(options) {
		super(options);
		this.Currency = options.Currency;
		this.BaseCurrency = options.BaseCurrency;

		if (!options.DefaultDepthSize) options.DefaultDepthSize = 20;

		if (!options.rateLimiter) options.rateLimiter = new RateLimit(1000, 10);

		this.options = options;

		if (options.isWS) {
			this.ws = new WS(options);
		}

		this.decimals = this.options.Decimals || 2;
		this.stockDecimals = 4;
		if (this.options.stockDecimals !== undefined) {
			this.stockDecimals = this.options.stockDecimals;
		}
		if (this.options.StockDecimals !== undefined) {
			this.stockDecimals = this.options.StockDecimals;
		}

		this.rest = new REST(options);
	
		this.fee = {
			BuyMaker: 0,
			SellMaker: 0,
			BuyTaker: 0,
			SellTaker: 0
		};
	}

	getHandler() {
		return this.options.isWS ? this.ws : this.rest;
	}

	GetAccount(interestedCoins, withInfo) {
		return this.getHandler().GetAccount().then(data => {
			if (!data.coins) throw new Error("zb.com GetAccount result error: " + JSON.stringify(data));
			let re = {
				Balance: 0,
				FrozenBalance: 0,
				Stocks: 0,
				FrozenStocks: 0
			};
			data.coins.map(a => {
				if (a.key === this.BaseCurrency.toLowerCase()) {
					re.Balance = N.parse(a.available);
					re.FrozenBalance = N.parse(a.freez);
				} else if (a.key.toUpperCase() === this.Currency) {
					re.Stocks = N.parse(a.available);
					re.FrozenStocks = N.parse(a.freez);
				} else if (a.key.toUpperCase() === 'ZB') {
					re.ZB = N.parse(a.available);
					re.FrozenZB = N.parse(a.freez);
				}

				if (interestedCoins && interestedCoins.indexOf(a.key.toUpperCase()) !== -1) {
					re[a.key.toUpperCase()] = N.parse(a.available);
					re['Frozen' + a.key.toUpperCase()] = N.parse(a.freez);
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
			if (withInfo) re.Info = data;
			return re;
		});
	}

	GetTicker(currency) {
		return this.rest.GetTicker(currency);
	}

	GetMin() {
		if (this.options.MinTradeAmount) return this.options.MinTradeAmount;
		if (this.Currency === 'BTC') return 0.0001;
		if (this.Currency === 'ZB') return 0.01;
		return 0.001;
	}

	Buy(price, amount, currency) {
		price = N(price).round(this.decimals);
		amount = N(amount).floor(this.stockDecimals);
		console.log(this.GetName(), 'Buy', price, amount, currency || '');
		return this.getHandler().Buy(price, amount, currency).then(id => {
			return id;
		});
	}

	Sell(price, amount, currency) {
		price = N(price).round(this.decimals);
		amount = N(amount).floor(this.stockDecimals);
		console.log(this.GetName(), 'Sell', price, amount, currency || '');
		return this.getHandler().Sell(price, amount, currency).then(id => {
			return id;
		});
	}

	waitUntilWSReady() {
		if (!this.options.isWS) return true;
		return this.ws.waitUntilWSReady();
	}

	CancelOrder(orderId, currency) {
		return this.getHandler().CancelOrder(orderId, currency).then(result => {
			return result;
		}).catch(err => {
			if (err && err.code === 3001) {
				return true;
			}
			throw err;
		});
	}

	async CancelPendingOrders() {
		return this.rest.GetOrders().then(arr => {
			console.log('got pending order from api:', arr);
			if (!arr) return [];
			return arr.filter(o => (o.Status === 'Pending' || o.Status === 'Partial'));
		}).then(async orders => {
			let re = {};
			if (orders && orders.length > 0) {
				debug('cancelling ', orders.length, 'orders');
				for (let i = 0; i < orders.length; i++) {
					re[orders[i].Id] = await this.CancelOrder(orders[i].Id);
				}
			}
			return re;
		});
	}

	GetOrders(currency) {
		return this.getHandler().GetOrders(currency).then(arr => {
			if (arr === undefined) {
				console.error('GetOrders got undefined');
				return [];
			}
			return arr;
		}).then(orders => {
			return orders;
		}).catch(err => {
			if (err.code === 3001) return [];
		});	
	}

	GetOrder(orderId) {
		return this.getHandler().GetOrder(orderId).then(o => {
			return o;
		});
	}

	GetDepth(size, merge) {
		if (!size && this.options.DefaultDepthSize) size = this.options.DefaultDepthSize;
		if (!merge && this.options.DefaultDepthMerge) merge = this.options.DefaultDepthMerge;
		return this.rest.GetDepth(size, merge);
	}

}

module.exports = ZB;
