const WS = require('./ws.js');
const REST = require('./rest.js');
const N = require('precise-number');
const debug = require('debug')('exchange:zb');
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
			DefaultDepthSize: 30,
			Currency: 'BTC',
			BaseCurrency: 'QC'
		}, options);
		super(options);

		if (this.options.isWS) {
			this.ws = new WS(this.options);
		}

		this.rest = new REST(this.options);
	}

	getHandler() {
		return this.options.isWS ? this.ws : this.rest;
	}

	async SubscribeDepth(currency, baseCurrency) {
		try {
			await this.ws.waitUntilWSReady();
			await this.ws.addSubscription(currency, baseCurrency, 'depth');
		} catch (err) {
			console.error(this.GetName() + ` SubscribeDepth got error:`, err);
		}
	}

	async SubscribeTicker(currency, baseCurrency) {
		try {
			await this.ws.waitUntilWSReady();
			await this.ws.addSubscription(currency, baseCurrency, 'ticker');
		} catch (err) {
			console.error(this.GetName() + ` SubscribeTicker got error:`, err);
		}
	}

	async SubscribePublicTrades(currency, baseCurrency) {
		try {
			await this.ws.waitUntilWSReady();
			await this.ws.addSubscription(currency, baseCurrency, 'trades');
		} catch (err) {
			console.error(this.GetName() + ` SubscribePublicTrades got error:`, err);
		}
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
				if (a.key === this.options.BaseCurrency.toLowerCase()) {
					re.Balance = N.parse(a.available);
					re.FrozenBalance = N.parse(a.freez);
				} else if (a.key.toUpperCase() === this.options.Currency) {
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

	Trade(type, price, amount, currency) {
		if (this.options.Decimals) price = N(price).round(this.options.Decimals);
		if (this.options.StockDecimals) amount = N(amount).floor(this.options.StockDecimals);
		console.log(this.GetName(), type, price, amount, currency || '');
		return this.getHandler()[type](price, amount, currency).then(id => {
			return id;
		});
	}

	Buy(...args) {
		return this.Trade('Buy', ...args);
	}

	Sell(...args) {
		return this.Trade('Sell', ...args);
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

	async GetTrades(page = 1) {
		let trades = await this.rest.GetTrades(page);
		trades = trades.map( t => {
			t.AvgPrice = t.Price;
			return t;
		});
		return trades.filter(o => (o.Status === 'Closed' || o.Status === 'Cancelled') && o.DealAmount > 0);
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
