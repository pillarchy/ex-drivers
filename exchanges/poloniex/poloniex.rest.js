const md5 = s => crypto.createHash('md5').update(s).digest('hex');
const sha1 = require('sha1');
const crypto = require('crypto');
const fetch = require('node-fetch');
const N = require('precise-number');
const R = require('ramda');
const moment = require('moment');

function wait(ms) {
	return new Promise( d => setTimeout(d, ms) );
}


class Poloniex {

	constructor(options) {
		this.key = options.Key;
		this.secret = options.Secret;
		this.options = options;
		this.symbol = options.Currency.toLowerCase();
	}

	GetName() {
		return this.options.Name ? this.options.Name : 'Poloniex';
	}

	fetch(httpMethod, method, params, isPublic) {

		if (!params) params = {};

		if (!isPublic) {
			params.key = this.key;
			params.nonce = Date.now();
		}

		let sortedParams = R.compose(
			R.join('&'), 
			R.sort(R.ascend(R.identity)), 
			R.map(a => a[0] + '=' + encodeURIComponent(a[1])), 
			R.toPairs
		)(params);

		if (!isPublic) {
			let hashedSecret = md5(this.secret);
			let hash = crypto.createHmac('sha256', Buffer.from(hashedSecret, 'utf8')).update(sortedParams).digest('hex');
			sortedParams += '&signature=' + encodeURIComponent(hash);
		}
		
		let url = 'https://poloniex.com' + method;
		let headers = {};
		let body = '';
		if (httpMethod === 'GET') {
			url += '?' + sortedParams;
		} else {
			body = sortedParams;
			headers['Content-Type'] = 'application/x-www-form-urlencoded';
		}

		//公共接口添加防缓存机制
		if (isPublic) {
			let sep = url.indexOf('?') === -1 ? '?' : '&';
			url += sep + '_t=' + Date.now();
		}

		// console.info('<<',httpMethod, url, JSON.stringify(body || 'nobody'));
		return fetch(url, {
			method: httpMethod,
			timeout: httpMethod === 'GET' ? 5000 : 10000,
			body,
			headers
		}).then(res => res.text()).then(s => {
			// console.info('>>',s);
			let data = null;
			try {
				data = JSON.parse(s);
			} catch (err) {
				console.error('Poloniex rest can not parse json:' + s);
				throw err;
			}
			if (data && data.result === false && data.code) {
				throw new Error('code=' + data.code + ' msg=' + this.errorCode(data.code));
			}
			return data;
		});
	}

	error(...args) {
		args = args.map(a => {
			if (typeof a === 'object') a = JSON.stringify(a);
			return a;
		});
		throw new Error( '[' + moment().format('YYYY-MM-DD HH:mm:ss') + '] ' + this.GetName() + ': ' + args.join(' '));
	}

	get(method, params, isPublic) {
		return this.fetch('GET', method, params, isPublic);
	}

	post(method, params) {
		return this.fetch('POST', method, params);
	}


	GetTicker() {
		return this.get('/api/v1/ticker/', {
			coin: this.symbol
		}, true).then(ticker => {
			return {
				High: N.parse(ticker.high, 2),
				Low: N.parse(ticker.low, 2),
				Buy: N.parse(ticker.buy, 2),
				Sell: N.parse(ticker.sell, 2),
				Last: N.parse(ticker.last, 2),
				Volume: N.parse(ticker.vol),
				Time: Date.now()
			};
		});
	}

	GetDepth(depth) {
		if (!depth) depth = 20;
		return this.get('/public', {
			command: 'returnOrderBook',
			currencyPair: this.symbol,
			depth
		}, true).then(tick => {
			if (!tick || !tick.asks || !tick.bids) throw new Error('get Poloniex ' + this.symbol + ' depth error ' + JSON.stringify(tick));

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

			return Promise.resolve({
				Asks: R.sort( R.descend( R.prop('Price') ), tick.asks),
				Bids: R.sort( R.descend( R.prop('Price') ), tick.bids)
			});
		});
	}

	GetAccount() {
		return this.post('/api/v1/balance/');
	}

	GetOrder(orderId) {
		return this.post('/api/v1/trade_view/', {
			coin: this.symbol,
			id: orderId
		});
	}

	GetOrders() {
		return this.post('/api/v1/trade_list/', {
			coin: this.symbol,
			type: 'open'
		});
	}

	CancelOrder(orderId) {
		return this.post('/api/v1/trade_cancel/', {
			coin: this.symbol,
			id: orderId
		}).then(r => {
			return (r && r.result);
		});
	}

	Trade(type, price, amount) {
		return this.post('/api/v1/trade_add/', {
			coin: this.symbol,
			amount,
			price,
			type
		}).then( r => {
			if (r && r.result && r.id) return r.id;
			throw new Error(JSON.stringify(r));
		});
	}

	Buy(price, amount) {
		let action = 'buy';
		if (price == -1) price = 10000;
		return this.Trade(action, price, amount);
	}

	Sell(price, amount) {
		let action = 'sell';
		if (price === -1) price = 100;
		return this.Trade(action, price, amount);
	}

	errorCode(code) {
		let errors = {
			'100': '必选参数不能为空',
			'101': '非法参数',
			'102': '请求的虚拟币不存在',
			'103': '密钥不存在',
			'104': '签名不匹配',
			'105': '权限不足',
			'106': '请求过期(nonce错误)',
			'200': '余额不足',
			'201': '买卖的数量小于最小买卖额度',
			'202': '下单价格必须在 0 - 1000000 之间',
			'204': '成交金额不能少于 10 元',
			'205': 'gooc限制挂单价格',
			'203': '订单不存在',
			'401': '系统错误',
			'402': '请求过于频繁',
			'403': '非开放API',
			'404': 'IP限制不能请求该资源',
			'405': '币种交易暂时关闭',
		};
		code = code + '';
		return errors[code] || code;
	}

}



module.exports = Poloniex;