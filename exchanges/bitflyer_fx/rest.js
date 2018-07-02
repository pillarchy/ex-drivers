const fetch = require('node-fetch');
const R = require('ramda');
const debug = require('debug')('exchange:bitflyer:rest');
const crypto = require('crypto');
const urlencode = require('urlencode-for-php');
const ExError = require('../../lib/error');
const ErrorCode = require('../../lib/error-code');
const agent = require('../../lib/agent');

class BITFLYER_FX_REST {

	constructor(options) {
		this.key = options.Key;
		this.secret = options.Secret;
		this.symbol = 'FX_' + options.Currency + '_' + options.BaseCurrency;
		this.options = options;
	}

	fetch(url, params, method, allowEmptyResponse = false) {
		if (!method) throw new Error('need method');

		let body = '';
		if (method === 'GET') {
			if (params) {
				url = url + '?' + urlencode(params);
			}
		} else {
			body = JSON.stringify(params);
		}

		let timestamp = Date.now().toString();
		let text = timestamp + method + url + body;
		let sign = crypto.createHmac('sha256', this.secret).update(text).digest('hex');

		debug('<<', method, url, 'BODY:', body);

		let httpMethod = method ? method : 'POST';

		let options = {
			method: httpMethod,
			timeout: httpMethod === 'GET' ? 5000 : 10000,
			headers: {
				'ACCESS-KEY': this.key,
				'ACCESS-TIMESTAMP': timestamp,
				'ACCESS-SIGN': sign,
				'Content-Type': 'application/json'
			},
			agent: agent.https
		};

		if (body) options.body = body;
		return fetch('https://api.bitflyer.jp' + url, options).then(async res => {
			let status = res.status;
			if (status === 404) throw new ExError(ErrorCode.URL_NOT_FOUND, `resource ${url} not found (404)`);
			if (status === 429) throw new ExError(ErrorCode.REQUEST_TOO_FAST, `request too fast (${url})`);

			return {
				t: await res.text(),
				status
			};
		}).then(info => {
			let { t, status } = info;
			debug('>> ' + status + ':' + t);

			if (allowEmptyResponse && status === 200) return true;
			if (!t) return Promise.reject('Bitflyer returns empty: ' + url);
			try {
				let d = JSON.parse(t);
				return Promise.resolve(d);
			} catch ( err ) {
				return Promise.reject('Bitflyer JSON parse error: ' + t);
			}
		}).catch(err => {
			console.error('Bitflyer request error', err);
			throw err;
		});
	}

	GetTicker() {
		return this.fetch(`/v1/getticker`, {
			product_code: this.symbol
		}, 'GET');
	}

	GetAccount() {
		return this.fetch('/v1/me/getcollateralaccounts', null, 'GET');
	}

	GetPosition() {
		return this.fetch(`/v1/me/getpositions?product_code=${this.symbol}`, null, 'GET');
	}

	GetCollateral() {
		return this.fetch(`/v1/me/getcollateral?product_code=${this.symbol}`, null, 'GET');
	}

	GetOrders(orderId) {
		let params = {
			product_code: this.symbol,
			child_order_state: 'ACTIVE'
		};
		if (orderId) {
			params.child_order_acceptance_id = orderId;
			delete params.child_order_state;
		}
		return this.fetch('/v1/me/getchildorders', params, 'GET');
	}

	Trade(type, price, amount) {
		let params = {
			product_code: this.symbol,
			child_order_type: "LIMIT",
			side: type === 'Long' ? 'BUY' : 'SELL',
			price,
			size: amount
		};
		return this.fetch('/v1/me/sendchildorder', params, 'POST').then(o => {
			if (o && o.status === -205) throw new ExError(ErrorCode.INSUFFICIENT_BALANCE, JSON.stringify(o));
			if (o && o.child_order_acceptance_id) return o.child_order_acceptance_id;
			throw new Error('Bitflyer sendchildorder api returns bad data: ' + JSON.stringify(o));
		});
	}

	CancelOrder(orderId) {
		let params = {
			product_code: this.symbol,
			child_order_acceptance_id: orderId
		};
		return this.fetch('/v1/me/cancelchildorder', params, 'POST', true).then(() => {
			return true;
		});
	}

	CancelPendingOrders() {
		let params = {
			product_code: this.symbol
		};
		return this.fetch('/v1/me/cancelallchildorders', params, 'POST', true).then(() => {
			return true;
		});
	}

	GetDepth() {
		
		return this.fetch(`/v1/getboard?product_code=${this.symbol}`, null, 'GET').then(data => {

			if (!data || !data.bids || !data.asks) throw new Error('get bitflyer ' + this.symbol + ' depth error ' + JSON.stringify(data));

			let asks = [];
			let bids = [];

			for (let i = 0; i < data.bids.length; i++) {
				bids.push({
					Price: data.bids[i].price * 1,
					Amount: data.bids[i].size * 1
				});
			}

			for (let i = 0; i < data.asks.length; i++) {
				asks.push({
					Price: data.asks[i].price * 1,
					Amount: data.asks[i].price * 1
				});
			}

			return Promise.resolve({
				Asks: R.sort( R.ascend( R.prop('Price') ), asks),
				Bids: R.sort( R.descend( R.prop('Price') ), bids),
				Currency: this.options.Currency,
				BaseCurrency: this.options.BaseCurrency,
				ContractType: this.options.ContractType
			});
		});
	}
}


module.exports = BITFLYER_FX_REST;
