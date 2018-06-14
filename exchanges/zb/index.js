const WS = require('./ws.js');
const REST = require('./rest.js');
const N = require('precise-number');
const debug = require('debug')('exchange:zb');
const RateLimit = require('../../lib/rate-limit');
const EXCHANGE = require('../exchange.js');

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
			DefaultDepthSize: 30
		}, options);
		super(options);

		this.Currency = this.options.Currency;
		this.BaseCurrency = this.options.BaseCurrency;

		if (this.options.isWS) {
			this.ws = new WS(this.options);
		}

		this.decimals = this.options.Decimals || 2;
		this.stockDecimals = this.options.StockDecimals;

		this.rest = new REST(this.options);
	}

	getHandler() {
		return this.options.isWS ? this.ws : this.rest;
	}

	async SendWSCommand(cmd) {
		await this.waitUntilWSReady();
		await this.ws.ws.send(cmd);
	}

	GetAccount() {
		return this.getHandler().GetAccount().then(data => {
			if (!data.coins) throw new Error("zb GetAccount result error: " + JSON.stringify(data));
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

	GetTicker(currency) {
		return this.rest.GetTicker(currency);
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
