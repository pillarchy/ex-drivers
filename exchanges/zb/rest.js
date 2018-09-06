
const N = require('precise-number');
const { ok } = require('assert');
const R = require('ramda');
const sha1 = require('sha1');
const crypto = require('crypto');
const fetch = require('node-fetch');
const debug = require('debug')('exchange:zb:rest');
const debugOrder = require('debug')('order');
const ExError = require('../../lib/error');
const ErrorCode = require('../../lib/error-code');

const agent = require('../../lib/agent');

class ZB_REST {
	constructor(options) {
		this.options = options;
		if (!this.options.rateLimiter) throw 'No rateLimiter in options';
		this.history = [];
		this.symbol = (this.options.Currency + '_' + this.options.BaseCurrency).toLowerCase();
	}

	async request(_params, timeout = 5000) {
		await this.options.rateLimiter.wait();	
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
		debug('<<<', params);

		return (this.options.fetchFunction || fetch)('https://trade.zb.com/api/' + params.method + '?' + vars.join('&'), {
			method: 'GET',
			timeout,
			agent: agent.https
		}).then(async res => {
			let raw = await res.text();
			let status = res.status;
			debug('>>>', status, raw);
			try {
				let r = JSON.parse(raw);
				if (r.code && r.message && r.code * 1 !== 1000) throw r;
				if (r && r.result) return r.result;
				return r;
			} catch (err) {
				if (err && err.code) throw err;
				throw new ExError(ErrorCode.UNKNOWN_ERROR, raw, err);
			}
		}).catch(err => {
			if (err.type === 'request-timeout') {
				throw new ExError(ErrorCode.REQUEST_TIMEOUT, `rest request (${params.method}) timeout`, err);
			}
			throw err;
		});
	}

	async get(method, params = {}, timeout = 5000) {
		let vars = [];
		for (let key in params) {
			vars.push(key + '=' + encodeURIComponent(params[key]));
		}
		let url = 'http://api.zb.com/data/v1/' + method + '?' + vars.join('&');
		debug('<<<', url);

		return fetch(url, {
			method: 'GET',
			timeout,
			agent: agent.http
		}).then(async res => {
			let raw = await res.text();
			let status = res.status;
			debug('>>>', status, raw);
			if (status !== 200) throw new ExError(ErrorCode.BAD_RESPONSE_STATUS, `zb rest request to ${url} returns bad status: ` + status);
			try {
				let r = JSON.parse(raw);
				return r;
			} catch (err) {
				throw new ExError(ErrorCode.UNKNOWN_ERROR, raw, err);
			}
		}).catch(err => {
			console.log(err);
			if (err.type === 'request-timeout') {
				throw new ExError(ErrorCode.REQUEST_TIMEOUT, `zb rest request (${url}) timeout`, err);
			}
			throw err;
		});
	}

	GetAccount() {
		return this.request({
			method: 'getAccountInfo'
		}).then(data => {
			data.route = 'rest';
			return data;
		});
	}

	async GetTicker(Currency, BaseCurrency) {
		const symbol = this._getSymbol(Currency, BaseCurrency);
		let data = await this.get('ticker', {market: symbol});
		data.route = 'rest';
		return data;
	}

	async GetTickers() {
		let data = await this.get('allTicker', {t: Date.now()});
		return data;
	}

	GetTrades(page = 1, pageSize = 100, Currency, BaseCurrency) {
		return this.request({
			currency: this._getSymbol(Currency, BaseCurrency),
			method: 'getOrdersIgnoreTradeType',
			pageIndex: page,
			pageSize 
		}).catch(err => {
			if (err && err.code === 3001) return [];
			if (err && err.type === 'request-timeout') throw `zb getTrades timed out`;
			throw err;
		});
	}

	_getSymbol(Currency = '', BaseCurrency = '') {
		let c = Currency || this.options.Currency;
		let bc = BaseCurrency || this.options.BaseCurrency;
		return c.toLowerCase() + '_' + bc.toLowerCase();
	}

	Trade(type, price, amount, Currency, BaseCurrency) {
		ok( amount > 0, 'amount should greater than 0');
		return this.request({
			amount,
			currency: this._getSymbol(Currency, BaseCurrency),
			method: 'order',
			price: price + '',
			tradeType: type === 'Sell' ? 0 : 1
		}).then(o => {
			if (o && o.id) return o.id;
			throw new Error(JSON.stringify(o));
		});
	}

	CancelOrder(orderId, Currency, BaseCurrency) {
		return this.request({
			method: `cancelOrder`,
			currency: this._getSymbol(Currency, BaseCurrency),
			id: orderId
		}).then(a => a && a.code * 1 === 1000);
	}

	async GetOrders(Currency, BaseCurrency) {
		let re = [], orders = [], page = 0;
		try {
			do {
				page++;
				orders = await this.request({
					currency: this._getSymbol(Currency, BaseCurrency),
					method: 'getUnfinishedOrdersIgnoreTradeType',
					pageIndex: page,
					pageSize: 10
				}, 10000);
				if (orders && orders.length > 0) re = re.concat(orders);
			} while ( orders.length === 10 );
			return re;
		} catch (err) {
			if (re && re.length > 0) return re;
			throw err;
		}
	}

	GetOrder(orderId, Currency, BaseCurrency) {
		return this.request({
			currency: this._getSymbol(Currency, BaseCurrency),
			method: 'getOrder',
			id: orderId
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

		let Currency = this.options.Currency;
		let BaseCurrency = this.options.BaseCurrency;
		if (o.currency && /^\w+\_\w+$/.test(o.currency)) {
			let arr = o.currency.split('_');
			Currency = String(arr[0]).toUpperCase();
			BaseCurrency = String(arr[1]).toUpperCase();
		}
		let re = {
			Id: o.id,
			Price: N.parse(o.price),
			Amount: N.parse(o.total_amount),
			DealAmount: N.parse(o.trade_amount),
			Type: (o.type && o.type * 1 === 1) ? 'Buy' : 'Sell',
			Time: N.parse(o.trade_date),
			Status: _order_status(o.status * 1),
			Currency,
			BaseCurrency,
			Info: o
		};

		if (re.DealAmount === 0 && re.Status === 'Partial') re.Status = 'Pending';
		debugOrder('transformed order', JSON.stringify(re));
		return re;
	}

	GetDepth(Currency, BaseCurrency, size, merge) {
		if (!size) size = 30;
		if (!Currency) Currency = this.options.Currency;
		if (!BaseCurrency) BaseCurrency = this.options.BaseCurrency;
		let params = {
			size,
			market: this._getSymbol(Currency, BaseCurrency),
			_t: Math.random()
		};
		if (merge) params.merge = merge;

		return this.get('depth', params).then(data => {
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
				Asks: R.sort( R.ascend( R.prop('Price') ), asks),
				Bids: R.sort( R.descend( R.prop('Price') ), bids),
				Currency,
				BaseCurrency,
				Time: data.timestamp * 1000
			};

			return depth;
		});
	}

	async GetRecords(seconds = 60, size = 1000, Currency, BaseCurrency) {
		let type = this._secondsToPeriod(seconds);
		if (!type) throw new Error('zb GetRecords does not support this period: ' + seconds);
		if (size > 1000) throw new Error('zb GetRecords size should not larger than 1000');
		
		let data = await this.get('kline', {
			market: this._getSymbol(Currency, BaseCurrency),
			type,
			size
		});

		if (data && data.data) {
			return data.data.map(d => {
				return {
					Time: N.parse(d[0]),
					Open: N.parse(d[1]),
					High: N.parse(d[2]),
					Low: N.parse(d[3]),
					Close: N.parse(d[4]),
					Volume: N.parse(d[5])
				};
			});
		} else {
			throw new Error(`zb got bad kline data: ${JSON.stringify(data)}`);
		}
	}

	_secondsToPeriod(seconds) {
		if (seconds === 60) return '1min';
		if (seconds === 180) return '3min';
		if (seconds === 300) return '5min';
		if (seconds === 900) return '15min';
		if (seconds === 1800) return '30min';
		if (seconds === 86400) return '1day';
		if (seconds === 86400 * 3) return '3day';
		if (seconds === 86400 * 7) return '1week';
		if (seconds === 3600) return '1hour';
		if (seconds === 3600 * 2) return '2hour';
		if (seconds === 3600 * 4) return '4hour';
		if (seconds === 3600 * 6) return '6hour';
		if (seconds === 3600 * 12) return '12hour';
		return null;
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

module.exports = ZB_REST;
