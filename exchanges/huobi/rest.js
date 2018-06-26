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
const debug = require('debug')('huobi:rest');
const ExError = require('../../lib/error');
const ErrorCode = require('../../lib/error-code');

const agent = require('../../lib/agent');

class HUOBI_REST {

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

	_getSymbol(Currency, BaseCurrency) {
		let c = Currency || this.options.Currency;
		let bc = BaseCurrency || this.options.BaseCurrency;
		return String(c + bc).toLowerCase();
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
		debug('<<<', httpMethod, url, JSON.stringify(body || 'nobody'));
		return fetch(url, {
			method: httpMethod,
			timeout: httpMethod === 'GET' ? 5000 : 10000,
			body: body !== undefined ? JSON.stringify(body) : undefined,
			headers: {
				'Content-Type': 'application/json',
				'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/39.0.2171.71 Safari/537.36'
			},
			agent: agent.https
		}).then(async res => {
			let s = await res.text();
			let status = res.status;

			if (status !== 200) throw new ExError(ErrorCode.BAD_RESPONSE_STATUS, `Huobi response bad status(${status})`, s);

			debug('>>>', s);
			let data = null;
			try {
				data = JSON.parse(s);
			} catch (err) {
				throw new ExError(ErrorCode.INVALID_JSON, 'HuobiProRest can not parse json', err);
			}

			if (data && data.status === 'error') {

				if (['order-accountbalance-error', 'account-transfer-balance-insufficient-error', 'account-frozen-balance-insufficient-error'].indexOf(data['err-code']) > -1) {
					throw new ExError(ErrorCode.INSUFFICIENT_BALANCE, data['err-msg'], data);
				}

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

			if (!data || data.status !== 'ok') {
				this.error('api response error:', data);
			} else {
				return data;
			}
		}).catch(err => {
			if (err.type === 'request-timeout') {
				throw new ExError(ErrorCode.REQUEST_TIMEOUT, `huobi rest request (${params.method}) timeout`, err);
			}
			throw err;
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

	GetTicker(Currency, BaseCurrency) {
		return this.get('/market/detail/merged', {
			symbol: this._getSymbol(Currency, BaseCurrency)
		}).then(data => {
			let t = data.tick;
			if (!t || !t.ask || !t.bid) this.error('ticker response error:', data);
			
			return {
				High: N.parse(t.high),
				Low: N.parse(t.low),
				Buy: N.parse(t.bid[0]),
				Sell: N.parse(t.ask[0]),
				Last: N(t.bid[0]).add(t.ask[0]).div(2) * 1,
				Volume: N.parse(t.vol),
				Time: N.parse(data.ts),
				...this._parse_ch(data.ch, Currency, BaseCurrency),
				Info: data
			};
		});
	}

	_parse_ch(ch, Currency, BaseCurrency) {
		if (!Currency) Currency = this.options.Currency;
		if (!BaseCurrency) BaseCurrency = this.options.BaseCurrency;

		let ms = (ch || '').match(/\b([^\.]+?)(usdt|btc|eth|ht|eos)\b/);
		if (ms && ms[1]) Currency = String(ms[1]).toUpperCase();
		if (ms && ms[2]) BaseCurrency = String(ms[2]).toUpperCase();
		return { Currency, BaseCurrency };
	}

	GetDepth(Currency, BaseCurrency, type) {
		type = R.defaultTo(this.options.DefaultDepthStep, type);
		return this.get('/market/depth', {
			symbol: this._getSymbol(Currency, BaseCurrency),
			type
		}).then(data => {
			let tick = data.tick;
			if (!tick) this.error('got depth with no tick', data);
			if (!tick.bids || !tick.asks) this.error('got broken depth data', data);

			tick.bids = tick.bids.map(b => {
				return {
					Price: N.parse(b[0]),
					Amount: N.parse(b[1])
				};
			});

			tick.asks = tick.asks.map(a => {
				return {
					Price: N.parse(a[0]),
					Amount: N.parse(a[1])
				};
			});

			return {
				Asks: R.sort( R.ascend( R.prop('Price') ), tick.asks),
				Bids: R.sort( R.descend( R.prop('Price') ), tick.bids),
				Time: N.parse(data.ts),
				...this._parse_ch(data.ch, Currency, BaseCurrency)
			};
		});
	}

	GetTrades(Currency, BaseCurrency) {
		return this.get('/market/trade', {
			symbol: this._getSymbol(Currency, BaseCurrency)
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

	async GetAccount(Currency, BaseCurrency, type = 'spot') {
		if (!Currency) Currency = this.options.Currency;
		if (!BaseCurrency) BaseCurrency = this.options.BaseCurrency;

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
				Balance: info[`${BaseCurrency}_trade`],
				FrozenBalance: info[`${BaseCurrency}_frozen`],
				Stocks: info[`${Currency}_trade`],
				FrozenStocks: info[`${Currency}_frozen`],
				Currency,
				BaseCurrency,
				Info: data
			};
		} else {
			throw new Error('no list info for account ' + accountId);
		}
	}

	async GetAccounts(type = 'spot') {
		let a = await this.GetAccount('', '', type);
		if (a && a.Info && a.Info.data && a.Info.data.list) {
			let cache = {}, re = [];
			a.Info.data.list.map(c => {
				cache[c.currency + '_' + c.type] = N.parse(c.balance);
			});
			a.Info.data.list.map(c => {
				let Currency = String(c.currency).toUpperCase();
				if (cache[Currency]) return;
				cache[Currency] = 1;
				re.push({
					Currency,
					Free: cache[c.currency + '_' + 'trade'],
					Frozen: cache[c.currency + '_' + 'frozen']
				});
			});
			return re;
		}
	}

	GetOrder(orderId) {
		return this.get('/v1/order/orders/' + orderId).then(r => {
			if (!r.data) this.error('can not get order detail:', orderId, r);
			return r.data;
		});
	}

	GetOrders(Currency, BaseCurrency) {
		return this.get('/v1/order/orders', {
			symbol: this._getSymbol(Currency, BaseCurrency),
			states: 'pre-submitted,submitted,partial-filled,partial-canceled'
		}).then(r => {
			if (!r.data) this.error('can not get orders:', r);
			return r.data;
		});
	}

	GetTrades(Currency, BaseCurrency) {
		return this.get('/v1/order/orders', {
			symbol: this._getSymbol(Currency, BaseCurrency),
			states: 'partial-canceled,filled,canceled',
			size: 100
		}).then(r => {
			if (!r.data) this.error('can not get trades:', r);
			return r.data;
		});
	}

	CancelOrder(orderId) {
		return this.post('/v1/order/orders/' + orderId + '/submitcancel').then(r => {
			// console.log(r);
			if (!r.data) this.error('can not cancel order:', orderId, r);
			return true;
		}).catch(err => {
			console.error(err);
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

	_create_order(type, price, amount, Currency, BaseCurrency) {
		return this._get_account_id().then(accountId => {
			let params = {
				"account-id": accountId + '',
				amount: amount + '',
				price: price + '',
				source: "api",
				symbol: this._getSymbol(Currency, BaseCurrency),
				type
			};

			console.log(this.options.hadax ? 'HADAX' : 'HUOBIPRO', type, price, amount, Currency || this.options.Currency, BaseCurrency || this.options.BaseCurrency);

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

	Trade(type, price, amount, Currency, BaseCurrency) {
		let __type = price === -1 ? 'market' : 'limit';
		let _type = `${type}-${__type}`.toLowerCase();
		return this._create_order(_type, price, amount, Currency, BaseCurrency);
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
		return fetch(url, {
			agent: agent.https,
			timeout: 10000
		}).then(res => res.json());
	}
}

module.exports = HUOBI_REST;
