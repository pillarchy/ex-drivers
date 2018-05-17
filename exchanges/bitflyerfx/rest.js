const fetch = require('node-fetch');
const N = require('precise-number');
const R = require('ramda');
const debug = require('debug')('exchange:bitflyer:rest');
const wait = require('delay');
const crypto = require('crypto');
const urlencode = require('urlencode-for-php');

class REST {

	constructor(options) {
		this.key = options.Key;
		this.secret = options.Secret;
		if (!options.Currency) options.Currency = 'BTC';
		if (!options.BaseCurrency) options.BaseCurrency = 'JPY';
		this.symbol = 'FX_' + options.Currency + '_' + options.BaseCurrency;
	}

	fetch(url, params, method) {
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

		return fetch('https://api.bitflyer.jp' + url, {
			method: httpMethod,
			timeout: httpMethod === 'GET' ? 5000 : 10000,
			body,
			headers: {
				'ACCESS-KEY': this.key,
				'ACCESS-TIMESTAMP': timestamp,
				'ACCESS-SIGN': sign,
				'Content-Type': 'application/json'
			}
		}).then(res => res.text()).then(t => {
			debug('>> ' + t);

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
		return this.fetch('/v1/me/getpositions?product_code=FX_BTC_JPY', null, 'GET');
	}

	GetOrder(orderId) {
		return this.fetch('order_info.do', {
			symbol: this.coin_type,
			order_id: orderId
		});
	}

	GetOrders() {
		return this.fetch('/v1/me/getchildorders', {
			product_code: this.symbol,
			child_order_state: 'ACTIVE'
		}, 'GET');
	}

	Trade(type, price, amount) {
		let params = {
			symbol: this.coin_type,
			type: type,
			price,
			amount
		};
		if (type == 'buy_market') {
			params.price = params.amount;
			delete(params.amount);
		}
		if (type == 'sell_market') {
			delete(params.price);
		}
		return this.fetch('trade.do', params);
	}

	Buy(price, amount) {
		let action = 'buy';
		if (N.equal(price, -1)) action = 'buy_market';
		return this.Trade(action, price, amount);
	}

	Sell(price, amount) {
		let action = 'sell';
		if (N.equal(price, -1)) action = 'sell_market';
		return this.Trade(action, price, amount);
	}



	buy(price, amount) {
		return this.fetch({
			method: 'buy',
			coin_type: this.coin_type,
			price: price,
			amount: amount
		});
	}

	sell(price, amount) {
		return this.fetch({
			method: 'sell',
			coin_type: this.coin_type,
			price: price,
			amount: amount
		});
	}

	buyMarket(amount) {
		return this.fetch({
			method: 'buy_market',
			coin_type: this.coin_type,
			amount: amount
		});
	}


	sellMarket(amount) {
		return this.fetch({
			method: 'sell_market',
			coin_type: this.coin_type,
			amount: amount
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
				Asks: R.sort( R.descend( R.prop('Price') ), asks),
				Bids: R.sort( R.descend( R.prop('Price') ), bids)
			});
		});
	}
}


module.exports = REST;
