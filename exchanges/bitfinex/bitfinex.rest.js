const fetch = require('node-fetch');
const N = require('precise-number');
const R = require('ramda');
const qs = require('querystring');
const crypto = require('crypto');
const assert = require('assert');

function wait(ms) {
	return new Promise( d => setTimeout(d, ms) );
}


class Bitfinex {

	constructor(options) {
		this.debug = false;
		this.key = options.Key;
		this.secret = options.Secret;
		if (!options.Currency) options.Currency = 'BTC';
		this.options = options;
		this.symbol = options.Currency.toLowerCase() + 'usd';
	}

	fetch(url, params, method, isPublic) {

		const baseUrl = 'https://api.bitfinex.com';
		if (params && isPublic) url += '?' + qs.stringify(params);
		const completeURL = baseUrl + url;
		let headers = {}, body = '';

		if (!isPublic) {
			const nonce = Date.now().toString();
			body = JSON.stringify(Object.assign( params || {}, {
				request: url,
				nonce
			}));
			const payload = new Buffer(body).toString('base64');
			const signature = crypto.createHmac('sha384', this.secret).update(payload).digest('hex');
			headers = {
				'X-BFX-APIKEY': this.key,
				'X-BFX-PAYLOAD': payload,
				'X-BFX-SIGNATURE': signature
			};
		}

		if (this.debug) {
			console.log('<< ' + method + ' ' + completeURL + '  BODY:' + "\n" + body);
		}

		let httpMethod = method ? method : 'POST';

		return fetch(completeURL, {
			method: httpMethod,
			timeout: httpMethod === 'GET' ? 10000 : 10000,
			body,
			headers
		}).then(res => res.text()).then(t => {
			if (this.debug) {
				console.log('>>' + t);
			}
			if (!t) return Promise.reject('Bitfinex returns empty: ' + url);
			try {
				let d = JSON.parse(t);
				if (Object.keys(d).length === 1 && d.message) {
					return Promise.reject(d.message);
				} else {
					return Promise.resolve(d);
				}
			} catch ( err ) {
				return Promise.reject('Bitfinex JSON parse error: ' + t);
			}
		});

		// .then(json=>{
		// 	if (json && json.error_code) {
		// 		json.error_message = errorMessage(json.error_code);
		// 		throw new Error(JSON.stringify(json));
		// 	} else {
		// 		return Promise.resolve(json);
		// 	}
		// });
	}


	// fetch2(url, params, method, isPublic) {

	// 	const baseUrl = 'https://api.bitfinex.com/';
	// 	if (params && isPublic) url += '?' + qs.stringify(params);
	// 	const completeURL = baseUrl + url;
	// 	let headers = {}, body = '';

	// 	if (!isPublic) {
	// 		const nonce = Date.now().toString();
	// 		body = JSON.stringify(params || {});
	// 		let signature = `/api/${url}${nonce}${body}`;
	// 		signature = crypto.createHmac('sha384', this.secret).update(signature).digest('hex');

	// 		headers = {
	// 			'bfx-nonce': nonce,
	// 			'bfx-apikey': this.key,
	// 			'bfx-signature': signature,
	// 			'Content-Type': 'application/json'
	// 		};
	// 	}

	// 	if (this.debug) {
	// 		console.log('<< '+method+' '+completeURL+'  BODY:'+"\n"+body);
	// 	}

	// 	let httpMethod = method ? method : 'POST';

	// 	return fetch(completeURL, {
	// 		method: httpMethod,
	// 		timeout: httpMethod === 'GET' ? 10000 : 10000,
	// 		body,
	// 		headers
	// 	}).then(res=>res.text()).then(t=>{
	// 		if (this.debug) {
	// 			console.log('>>'+t);
	// 		}
	// 		if (!t) return Promise.reject('Bitfinex returns empty: '+url);
	// 		try {
	// 			var d = JSON.parse(t);
	// 			if (Object.keys(d).length === 1 && d.message) {
	// 				return Promise.reject(d.message);
	// 			} else {
	// 				return Promise.resolve(d);
	// 			}
	// 		} catch( err ) {
	// 			return Promise.reject('Bitfinex JSON parse error: '+t);
	// 		}
	// 	});

	// 	// .then(json=>{
	// 	// 	if (json && json.error_code) {
	// 	// 		json.error_message = errorMessage(json.error_code);
	// 	// 		throw new Error(JSON.stringify(json));
	// 	// 	} else {
	// 	// 		return Promise.resolve(json);
	// 	// 	}
	// 	// });
	// }

	GetTicker() {
		return this.fetch('/v1/pubticker/' + this.symbol, null, 'GET', true).then(data => {
			return Promise.resolve({
				High: N.parse(data.high),
				Low: N.parse(data.low),
				Buy: N.parse(data.bid),
				Sell: N.parse(data.ask),
				Last: N.parse(data.last_price),
				Volume: N.parse(data.volume),
				Time: data.timestamp
			});
		});
	}


	GetDepth(size, merge) {
		if (!size) size = 10;
		let params = {};
		if (size) {
			params.limit_bids = size;
			params.limit_asks = size;
		}
		merge = !merge ? '0' : '1';
		params.merge = merge;

		return this.fetch('/v1/book/' + this.symbol, params, 'GET', true).then(data => {

			if (!data || !data.bids || !data.asks) throw new Error('get bitfinex ' + this.symbol + ' depth error ' + JSON.stringify(data));

			let asks = data.asks.map(r => {
				return {
					Price: N.parse(r.price),
					Amount: N.parse(r.amount)
				};
			});

			let bids = data.bids.map(r => {
				return {
					Price: N.parse(r.price),
					Amount: N.parse(r.amount)
				};
			});

			return Promise.resolve({
				Asks: R.sort( R.descend( R.prop('Price') ), asks),
				Bids: R.sort( R.descend( R.prop('Price') ), bids)
			});
		});
	}


	GetAccount() {
		return this.fetch('/v1/balances', null, 'POST').then(accounts => {

			// console.log(JSON.stringify(accounts));

			let currency = this.options.Currency.toLowerCase();
			let fiat = 'usd';
			let re = {
				Balance: 0,
				Stocks: 0,
				FrozenStocks: 0,
				FrozenBalance: 0
			};

			accounts.map(account => {
				if (account.type === 'exchange') {
					if (account.currency === currency) {
						re.Stocks = N.parse(account.available);
						re.FrozenStocks = N.minus(account.amount, account.available);
					} else if (account.currency === fiat) {
						re.Balance = N.parse(account.available);
						re.FrozenBalance = N.minus(account.amount, account.available);
					}

					re[(account.currency + '').toUpperCase()] = {
						Available: N.parse(account.available),
						Frozen: N.minus(account.amount, account.available)
					};
				}
			});

			return re;
		});
	}

	GetOrders() {
		return this.fetch('/v1/orders', null, 'POST');
	}

	GetOrder(orderId) {
		return this.fetch('/v1/order/status', {
			order_id: orderId
		}, 'POST');
	}

	CancelOrder(orderId) {
		return this.fetch('/v1/order/cancel', {
			order_id: orderId
		}, 'POST').then(data => {
			return !!(data && data.id);
		});
	}

	CancelOrders(orderIds) {
		return this.fetch('/v1/order/cancel/multi', {
			order_ids: orderIds
		}, 'POST').then(data => {
			assert.equal(data.result, "Orders cancelled");
			return true;
		});
	}

	CancelAllOrders() {
		return this.fetch('/v1/order/cancel/all', {}, 'POST').then(data => {
			let s = data.result;
			if (s === "None to cancel") return true;
			if (s === 'All orders cancelled') return true;
			throw new Error(s);
		});
	}

	Trade(side, price, amount, type) {
		let params = {
			symbol: this.symbol,
			price: price + '',
			amount: amount + '',
			side,
			type
		};
		/*
		{"id":4086495264,"cid":33145897920,"cid_date":"2017-10-01","gid":null,"symbol":"ethusd","exchange":"bitfinex","price":"330.0","avg_execution_price":"0.0","side":"buy","type":"exchange limit","timestamp":"1506849145.977395953","is_live":true,"is_cancelled":false,"is_hidden":false,"oco_order":null,"was_forced":false,"original_amount":"0.05","remaining_amount":"0.05","executed_amount":"0.0","src":"api","order_id":4086495264}
		 */
		return this.fetch('/v1/order/new', params, 'POST').then(r => {
			if (r && r.order_id) return r.order_id;
			throw new Error(JSON.stringify(r));
		});
	}

	Buy(price, amount) {
		let side = 'buy';
		let type = 'exchange limit';
		if (N.equal(price, -1)) {
			type = 'exchange market';
			price = 1;
		}
		return this.Trade(side, price, amount, type);
	}

	Sell(price, amount) {
		let side = 'sell';
		let type = 'exchange limit';
		if (N.equal(price, -1)) {
			type = 'exchange market';
			price = 1;
		}
		return this.Trade(side, price, amount, type);
	}
}


module.exports = Bitfinex;
