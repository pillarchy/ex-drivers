const fetch = require('node-fetch');
const N = require('precise-number');
const R = require('ramda');
const debug = require('debug')('bitmex:rest');
const crypto = require('crypto');

class Exchange {

	constructor(options) {
		this.key = options.Key;
		this.secret = options.Secret;
		this.symbol = options.Currency.toUpperCase() + options.BaseCurrency.toUpperCase();
		this.options = options;

		// this.bitmex = new BitMexPlus({
		// 	apiKeyID: this.key,
		// 	apiKeySecret: this.secret
		// });
	}

	async fetch(path, api = 'public', method = 'GET', params = {}, headers = undefined, body = undefined) {
		
		let info = this.sign(path, api, method, params, headers, body);	
		let options = {
			method,
			headers: info.headers,
			body: info.body
		};

		return fetch(info.url, options).then(res => res.text()).then(r => {
			debug(`${path} returns: `, r);
			try {
				r = JSON.parse(r);
			} catch (err) {
				throw new Error(`parse json response of ${path} error: ${err.message}`);
			}
			if (r && r.error) throw new Error(JSON.stringify(r.error));
			return r;
		});
	}

	urlencode(params) {
		let re = [];
		Object.keys(params).map(k => {
			if (typeof params[k] === 'object') params[k] = JSON.stringify(params[k]);
			re.push(`${k}=${encodeURIComponent(params[k])}`);
		});
		return re.join('&');
	}

	sign (path, api = 'public', method = 'GET', params = {}, headers = undefined, body = undefined) {
		let query = '/api/v1/' + path;
		if (method !== 'PUT' && Object.keys (params).length) query += '?' + this.urlencode(params);
		let url = 'https://www.bitmex.com' + query;
		if (api === 'private') {
			let nonce = Date.now() + '';
			let auth = method + query + nonce;
			if (method === 'POST' || method === 'PUT') {
				if (Object.keys (params).length) {
					body = this.json (params);
					auth += body;
				}
			}
			headers = {
				'Content-Type': 'application/json',
				'api-nonce': nonce,
				'api-key': this.key,
				'api-signature': crypto.createHmac('sha256', this.secret).update(auth).digest('hex')
			};
		}
		return { url, method, body, headers };
	}

	GetTicker() {
		return this.fetch('quote/bucketed', 'private', 'GET', {
			symbol: this.symbol,
			binSize: '1d',
			partial: true,
			count: 1,
			reverse: true
		}, true).then(d => {
			if (!d || d.length !== 1) throw new Error('bitmex get ticker error:' + JSON.stringify(d));
			return d[0];
		}).then(t => {
			return {
				Buy: N.parse(t.bidPrice),
				Sell: N.parse(t.askPrice),
				BuyAmount: N.parse(t.bidSize),
				SellAmount: N.parse(t.askSize),
				High: N.parse(t.askPrice),
				Low: N.parse(t.bidPrice),
				Volume: 0,
				Time: Date.now(),
				Info: t
			};
		});
	}

	GetAccount() {
		return this.fetch('user/margin', 'private', 'GET', {
			currency: 'XBt'
		});
	}

	GetPosition() {
		return this.fetch('position', 'private', 'GET', {
			filter: { symbol: this.symbol }
		});
	}

	GetOrders() {
		return this.fetch('order', 'private', 'GET', {
			symbol: this.symbol,
			filter: { open: true }
		});	
	}

	CancelOrder(orderId, contract_type) {
		return this.fetch('future_cancel.do', {
			symbol: this.symbol,
			order_id: orderId,
			contract_type: contract_type || this.options.DefaultContactType,
		});
	}

	Trade(direction, price, amount, contract_type) {
		let params = {
			symbol: this.symbol,
			contract_type,
			type: (['Long', 'Short'].indexOf(direction) + 1) + '',
			price,
			amount,
			match_price: price === -1 ? '1' : '0',
			lever_rate: this.options.MarginLevel
		};
		if (price === -1) {
			delete(params.price);
		}

		return this.fetch('future_trade.do', params);
	}

	GetKline(contract_type, type, size) {
		
	}

	GetDepth(contract_type, size, merge) {
		let params = ['symbol=' + this.symbol];
		if (!size) size = 30;
		if (size) params.push('size=' + size);
		if (merge) params.push('merge=' + merge);
		params.push('contract_type=' + (contract_type||this.options.DefaultContactType));

		return this.fetch('future_depth.do?' + params.join('&'), null, 'GET').then(data => {

			if (!data || !data.bids || !data.asks) throw new Error('get okcoin ' + this.symbol + ' depth error ' + JSON.stringify(data));

			let asks = [];
			let bids = [];

			for (let i = 0;i < data.bids.length;i++) {
				bids.push({
					Price: data.bids[i][0] * 1,
					Amount: data.bids[i][1] * 1
				});
			}

			for (let i = 0;i < data.asks.length;i++) {
				asks.push({
					Price: data.asks[i][0] * 1,
					Amount: data.asks[i][1] * 1
				});
			}

			bids.sort((a, b) => {
				let diff = a.Price - b.Price;
				return diff > 0 ? -1 : diff == 0 ? 0 : 1;
			});

			asks.sort((a, b) => {
				let diff = a.Price - b.Price;
				return diff > 0 ? 1 : diff == 0 ? 0 : -1;
			});

			return Promise.resolve({
				Asks: R.sort( R.descend( R.prop('Price') ), asks),
				Bids: R.sort( R.descend( R.prop('Price') ), bids)
			});
		});
	}
}

module.exports = Exchange;
