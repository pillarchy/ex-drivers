/*
* @Author: leosj
* @Date:   2017-12-25 23:18:20
* @Last Modified by:   leosj
* @Last Modified time: 2017-12-26 21:56:00
*/
const fetch = require('node-fetch');
const N = require('precise-number');
const R = require('ramda');
const crypto = require('crypto');
const moment = require('moment');
const debug = require('debug')('hbpro:rest');

class Huobi {

	constructor(options) {
		this.key = options.Key;
		this.secret = options.Secret;
		this.symbol =  options.Currency.toLowerCase() + options.BaseCurrency.toLowerCase();
		this.options = options;
		this.Currency = options.Currency;
		this.BaseCurrency = options.BaseCurrency;
		this.accountId = null;

		if (!this.options.rateLimiter) throw 'No rateLimiter in options';
	}

	async fetch(httpMethod, method, params, body) {
		await this.options.rateLimiter.wait();
		if (!params) params = {};
		params.AccessKeyId = this.key;
		params.SignatureMethod = 'HmacSHA256';
		params.SignatureVersion = '2';
		params.Timestamp = (new Date()).toISOString().substr(0, 19);

		let sortedParams = R.compose(
			R.join('&'),
			R.sort(R.ascend(R.identity)),
			R.map(a => a[0] + '=' + encodeURIComponent(a[1])),
			R.toPairs
		)(params);

		let signString = '';
		signString += httpMethod + '\n' + this.options.domain + '\n' + method + '\n' + sortedParams;

		let hash = crypto.createHmac('sha256', Buffer.from(this.secret, 'utf8')).update(signString).digest('base64');
		sortedParams += '&Signature=' + encodeURIComponent(hash);

		let url = 'https://' + this.options.domain + method + '?' + sortedParams;
		// console.info('<<',httpMethod, url, JSON.stringify(body || 'nobody'));
		return fetch(url, {
			method: httpMethod,
			timeout: httpMethod === 'GET' ? 5000 : 10000,
			body: body !== undefined ? JSON.stringify(body) : undefined,
			headers: {
				'Content-Type': 'application/json',
				'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/39.0.2171.71 Safari/537.36'
			}
		}).then(res => res.text()).then(s => {
			// console.info('>>',s);
			let data = null;
			try {
				data = JSON.parse(s);
			} catch (err) {
				console.error('HuobiProRest can not parse json:' + s);
				throw err;
			}

			if (data && data.status === 'error') {
				let err = new Error(data['err-msg'] || data['err-code'] || JSON.stringify(data));
				err.code = data['err-code'];
				err.url = url;
				err.body = body;
				err.error_code = data['err-code'];
				throw err;
				/*
				{"status":"error","err-code":"account-frozen-balance-insufficient-error","err-msg":"trade account balance is not enough, left: `0.9979`","data":null}
				 */
			}

			if (!data || data.status != 'ok') {
				this.error('api response error:', data);
			} else {
				return data;
			}
		});
	}

	GetName() {
		return this.options.Name ? this.options.Name : 'HuobiProRest';
	}

	get(method, params) {
		return this.fetch('GET', method, params);
	}

	post(method, params) {
		return this.fetch('POST', method, {}, params || {});
	}

	error(...args) {
		args = args.map(a => {
			if (typeof a === 'object') a = JSON.stringify(a);
			return a;
		});
		let err = new Error(this.GetName() + ': ' + args.join(' '));
		if (args[0] && args[0]['err-code']) err.code = args[0]['err-code'];
		throw err;
	}

	_get_account_id(type = 'spot') {
		if (this.accounts) return Promise.resolve(this.accounts[type]);
		return this.get('/v1/account/accounts').then(data => {
			let accounts = {};
			/*
			{ status: 'ok',
			  data:
			   [ { id: 3226379, type: 'spot', subtype: '', state: 'working' },
			     { id: 3258040, type: 'point', subtype: '', state: 'working' } ] }
			 */
			if (data && data.data && data.data.length > 0) {
				data.data.map(a => {
					accounts[a.type] = a.id;
				});
			}
			this.accounts = accounts;
			return this.accounts[type];
		});
	}

	GetTicker() {
		return this.get('/market/detail/merged', {
			symbol: this.symbol
		}).then(data => {
			/**
			 { amount: 7251.1279793922995, 成交量
				open: 13667.79, 开盘价
				close: 14850, 收盘价
				high: 15327.15, 最高价
				id: 809183597, k线id
				count: 94966, 成交笔数
				low: 13016.1, 最低价
				version: 809183597,
				ask: [ 14850, 0.6627 ],
				vol: 102287654.87463513, 成交额
				bid: [ 14849.82, 0.0045 ] }
			 */
			let t = data.tick;
			if (!t) this.error('ticker response error:', data);
			return t;
		});
	}

	GetDepth(type) {
		type = R.defaultTo('step0', type);
		return this.get('/market/depth', {
			symbol: this.symbol,
			type
		}).then(data => {
			let tick = data.tick;
			if (!tick) this.error('got depth with no tick', data);
			if (!tick.bids || !tick.asks) this.error('got broken depth data', data);
			return tick;
		});
	}

	GetTrades() {
		return this.get('/market/trade', {
			symbol: this.symbol
		}).then(data => {
			let trades = R.path(['tick', 'data'], data);
			if (!trades) this.error('got broken trades data:', data);
			return trades;
		});
	}

	GetMarketDetail() {
		return this.get('/market/detail', {
			symbol: this.symbol
		}).then(data => {
			if (!data.tick) this.error('got broken market detail data:', data);
			return data.tick;
		});
	}

	async GetAccount(type = 'spot') {
		let accountId = await this._get_account_id(type);

		let path = `/v1/account/accounts/${accountId}/balance`;
		if (this.options.hadax) {
			path = `/v1/hadax/account/accounts/${accountId}/balance`;
		}
		
		let data = await this.get(path);

		if (data && data.data && data.data.list && data.data.list.length > 0) {
			let accounts = data.data.list;
			debug('GetAccount result', accounts);
			let info = {};
			accounts.map(a => {
				info[ `${a.currency.toUpperCase()}_${a.type}` ] = N.parse(a.balance);
			});
			return {
				Balance: info[`${this.BaseCurrency}_trade`],
				FrozenBalance: info[`${this.BaseCurrency}_frozen`],
				Stocks: info[`${this.Currency}_trade`],
				FrozenStocks: info[`${this.Currency}_frozen`],
				Info: info
			};
		} else {
			throw new Error('no list info for account ' + accountId);
		}
	}

	GetOrder(orderId) {
		return this.get('/v1/order/orders/' + orderId).then(r => {
			if (!r.data) this.error('can not get order detail:', orderId, r);
			return r.data;
		});
	}

	GetOrders() {
		return this.get('/v1/order/orders', {
			symbol: this.symbol,
			states: 'pre-submitted,submitted,partial-filled,partial-canceled'
		}).then(r => {
			if (!r.data) this.error('can not get orders:', r);
			return r.data;
		});
	}

	CancelOrder(orderId) {
		return this.post('/v1/order/orders/' + orderId + '/submitcancel').then(r => {
			if (!r.data) this.error('can not cancel order:', orderId, r);
			return true;
		}).catch(err => {
            if (err && err.code === 'order-orderstate-error') {
                console.log('cancel a cancelled order');
                return true;
            }
			if (err && err.message && err.message.indexOf('order-orderstate-error') > 0) {
				console.log('cancel a cancelled order');
				return true;
			}
			throw err;
		});
	}

	CancelOrders(ids) {
		if (!ids || ids.length === 0) return true;
		return this.post('/v1/order/orders/batchcancel', {
			'order-ids': ids
		}).then(r => {
			if (r && r.data) {
				console.log('cancel order result:', r.data);
			}
			return true;
		});
	}

	_create_order(type, price, amount) {
		return this._get_account_id().then(accountId => {
			let params = {
				"account-id": accountId + '',
				amount: amount + '',
				price: price + '',
				source: "api",
				symbol: this.symbol,
				type
			};
			console.log(this.options.hadax ? 'HADAX' : 'HUOBIPRO', type, price, amount);
			if (type === 'buy-market' || type === 'sell-market') {
				delete(params.price);
			}
			let path = this.options.hadax ? '/v1/hadax/order/orders/place' : '/v1/order/orders/place';
			return this.post(path, params).then(r => {
				if (!r || r.status !== 'ok' || !r.data) this.error('can not create order:', amount, price, type, r);
				return r.data;
			});
		});
	}

	Trade(type, price, amount) {
		return this._create_order(type, price, amount);
	}

	Buy(price, amount) {
		let type = 'buy-limit';
		if (price === -1) type = 'buy-market';
		return this.Trade(type, price, amount);
	}

	Sell(price, amount) {
		if (amount <= 0) this.error('amount should not be zero');
		let type = 'sell-limit';
		if (price === -1) type = 'sell-market';
		return this.Trade(type, price, amount);
	}

	GetRecords(minutes) {

		let period = '';
		if (minutes == 1) period = '1min';
		if (minutes == 5) period = '5min';
		if (minutes == 15) period = '15min';
		if (minutes == 30) period = '30min';
		if (minutes == 60) period = '60min';
		if (minutes == 1440) period = '1day'; //日
		if (minutes == 10080) period = '1week'; //周

		if (!period) return Promise.reject(new Error('unsupported huobi kline period: ' + minutes + ' minutes'));

		let url = 'https://api.huobi.pro?symbol=' + this.symbol + '&period=' + period + '&size=300';
		return fetch(url).then(res => res.json());
	}
}

module.exports = Huobi;
