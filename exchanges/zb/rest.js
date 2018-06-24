const N = require('precise-number');
const { ok } = require('assert');
const R = require('ramda');
const sha1 = require('sha1');
const crypto = require('crypto');
const fetch = require('node-fetch');
const debug = require('debug')('exchange:zb:rest');
const debugOrder = require('debug')('order');

class EXCHANGE {
	constructor(options) {
		if (!options.Currency) options.Currency = 'BTC';
		if (!options.BaseCurrency) options.BaseCurrency = 'USDT';

		this.Currency = options.Currency;
		this.BaseCurrency = options.BaseCurrency;

		this.options = options;
		this.requestLimit = 10;
		this.requestLimitPeriod = 1000;

		if (!this.options.rateLimiter) throw 'No rateLimiter in options';

		this.history = [];

		this.symbol = this.Currency.toLowerCase() + '_' + this.BaseCurrency.toLowerCase();
	}

	GetName() {
		return this.options.Name ? this.options.Name : 'ZB';
	}

	async request(_params, timeout = 5000) {

		await this.options.rateLimiter.wait();	

		return new Promise(( done, reject) => {
			let params = {};
			params.accesskey = this.options.Key;
			params.method = _params.method;
			delete(_params.method);
			for (let key in _params) params[key] = _params[key];

			params.sign = sign(params, this.options.Secret);
			params.reqTime = Date.now();

			let vars = [];
			for (let key in params) {
				vars.push(key + '=' + encodeURIComponent(params[key]));
			}
			// debug('<<<', params);

			fetch('https://trade.bitkk.com/api/' + params.method + '?' + vars.join('&'), {
				method: 'GET',
				timeout
			}).then(r => r.json()).then(r => {
				// debug('>>>', JSON.stringify(r, null, '\t'));
				if (r.code && r.message && r.code * 1 !== 1000) throw r;
				if (r && r.result) return r.result;
				return r;
			}).then(done).catch(err => {
				reject(err);
			});
		});
	}

	GetAccount() {
		return this.request({
			method: 'getAccountInfo'
		}).catch(err => {
			if (err.type === 'request-timeout') {
				throw 'GetAccount timeout';
			}
			throw err;
		});
	}

	GetTicker(currency) {
		const symbol = this._getSymbol(currency);
		return fetch('http://api.bitkk.com/data/v1/ticker?market=' + symbol).then(r => r.json()).then(data => {
			if (!data.ticker) return;
			let t = data.ticker;
			return {
				Buy: N.parse(t.buy),
				Sell: N.parse(t.sell),
				High: N.parse(t.high),
				Last: N.parse(t.last),
				Low: N.parse(t.low),
				Volume: N.parse(t.vol)
			};
		});
	}

	GetTrades(page = 1) {
		return this.request({
			currency: this.symbol,
			method: 'getOrdersIgnoreTradeType',
			pageIndex: page,
			pageSize: 100
		}).then(arr => arr.map(o => this._transform_order(o))).catch(err => {
			if (err && err.type === 'request-timeout') throw `zb getTrades timed out`;
			throw err;
		});
	}

	_getSymbol(currency) {
		return (!currency) ? this.symbol : currency.toLowerCase() + '_' + this.BaseCurrency.toLowerCase();
	}

	_trade(tradeType, price, amount, currency) {
		ok( amount > 0, 'amount should greater than 0');
		const symbol = this._getSymbol(currency);
		return this.request({
			amount,
			currency: symbol,
			method: 'order',
			price: price + '',
			tradeType
		}).then(o => {
			if (o && o.id) return o.id;
			throw new Error(JSON.stringify(o));
		});
	}

	Buy(price, amount, currency) {
		return this._trade(1, price, amount, currency);
	}

	Sell(price, amount, currency) {
		return this._trade(0, price, amount, currency);
	}

	CancelOrder(orderId, currency) {
		return this.request({
			method: `cancelOrder`,
			currency: this._getSymbol(currency),
			id: orderId
		}).then(a => a && a.code * 1 === 1000);
	}

	async GetOrders(currency) {
		let re = [], orders = [], page = 0;
		try {
			do {
				page++;
				orders = await this.request({
					currency: this._getSymbol(currency),
					method: 'getUnfinishedOrdersIgnoreTradeType',
					pageIndex: page,
					pageSize: 10
				}, 10000).then(orders => orders.map(this._transform_order));
				if (orders && orders.length > 0) re = re.concat(orders);
			} while ( orders.length === 10 );
			return re;
		} catch (err) {
			if (re && re.length > 0) return re;
			// console.error(this.symbol, err);
			if (err && err.code === 3001) return [];
			// if (err && err.type === 'request-timeout') throw 'getUnfinishedOrdersIgnoreTradeType timeout';
			throw err;
		}
	}

	GetOrder(orderId) {
		return this.request({
			currency: this.symbol,
			method: 'getOrder',
			id: orderId
		}).then(this._transform_order).catch(err => {
			if (err && err.type === 'request-timeout') throw `getOrder(${orderId}) timed out`;
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
		debugOrder('original order', JSON.stringify(o));
		let re = {
			Id: o.id,
			Price: N.parse(o.price),
			Amount: N.parse(o.total_amount),
			DealAmount: N.parse(o.trade_amount),
			Type: (o.type && o.type * 1 === 1) ? 'Buy' : 'Sell',
			Time: N.parse(o.trade_date),
			Status: _order_status(o.status * 1),
			Info: o
		};

		if (re.DealAmount === 0 && re.Status === 'Partial') re.Status = 'Pending';
		debugOrder('transformed order', JSON.stringify(re));
		return re;
	}

	GetDepth(size, merge) {
		if (!size) size = 30;
		let url = `http://api.bitkk.com/data/v1/depth?size=${size}&market=${this.symbol}`;
		if (merge) url += '&merge=' + merge;

		debug('get depth url = ', url);
		return fetch(url).then(r => r.json()).then(data => {
			if (data && data.error) throw data.error;
			debug('get depth returns:', data);
			if (!data.asks || !data.bids) return;
			let asks = data.asks.map(pair => {
				return {
					Price: N.parse(pair[0]),
					Amount: N.parse(pair[1])
				};
			});

			let bids = data.bids.map(pair => {
				return {
					Price: N.parse(pair[0]),
					Amount: N.parse(pair[1])
				};
			});

			let depth = {
				Asks: R.sort( R.descend( R.prop('Price') ), asks).slice(-20),
				Bids: R.sort( R.descend( R.prop('Price') ), bids).slice(0, 20)
			};

			return depth;
		}).catch(err => {
			if (err && err.code === 'ETIMEDOUT') throw 'zb rest GetDepth timeout';
			if (err && err.response && err.response.status === 502) throw 'zb rest GetDepth got 502';
			throw err;
		});
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


function sign(params, secret) {
	let arr = [];
	for (let key in params) {
		arr.push(key + '=' + encodeURIComponent(params[key]));
	}
	arr = arr.sort();
	let body = arr.join('&');
	secret = sha1(secret);
	return hash_hmac(body, secret);
}

function hash_hmac(data, key) {
	const hmac = crypto.createHmac('md5', key);
	hmac.update(data);
	return hmac.digest('hex');
}

module.exports = EXCHANGE;
