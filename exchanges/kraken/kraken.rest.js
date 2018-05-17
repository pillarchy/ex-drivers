const fetch = require('node-fetch');
const N = require('precise-number');
const R = require('ramda');
const qs = require('querystring');
const crypto = require('crypto');
const assert = require('assert');

function wait(ms) {
	return new Promise( d => setTimeout(d, ms) );
}


const KrakenClient = require('kraken-api');


class Kraken {

	constructor(options) {
		this.debug = true;
		this.key = options.Key;
		this.secret = options.Secret;
		if (!options.Currency) options.Currency = 'BTC';
		this.options = options;
		this.symbol = 'X'+options.Currency.toUpperCase()+'ZUSD';

		this.kraken = new KrakenClient(this.key, this.secret);
	}

	GetTicker() {
		return this.kraken.api('Ticker', { pair : this.symbol }).then(data=>{
			if (data && data.result && data.result[this.symbol]) {
				let ticker = data.result[this.symbol];
				return Promise.resolve({
					High: N.parse(ticker.h[1]),
					Low: N.parse(ticker.l[1]),
					Volume: N.parse(ticker.v[1]),
					Last: N.parse(ticker.c[0]),
					Buy: N.parse(ticker.b[0]),
					Sell: N.parse(ticker.a[0]),
					Time: Date.now()
				});
			} else {
				throw data;
			}
		});
	}


	GetDepth(size) {
		return this.kraken.api('Depth', {
			pair : this.symbol,
			count: size
		}).then(data=>{
			if (data && data.result && data.result[this.symbol]) {
				let asks = data.result[this.symbol].asks.map(r=>{
					return {
						Price: N.parse(r[0]),
						Amount: N.parse(r[1])
					}
				});
				let bids = data.result[this.symbol].bids.map(r=>{
					return {
						Price: N.parse(r[0]),
						Amount: N.parse(r[1])
					}
				});

				return Promise.resolve({
					Asks: R.sort( R.descend( R.prop('Price') ), asks),
					Bids: R.sort( R.descend( R.prop('Price') ), bids)
				});
			} else {
				throw data;
			}
		});
	}

	GetAccount() {
		return this.kraken.api('OpenOrders');
	}

	GetOrders() {
		return this.kraken.api('OpenOrders').then(data=>{
			if (data.error && data.error.length > 0) throw data.error;
			let orders = (data.result && data.result.open ) || {};
			Object.keys(orders).map(order_id => {

			});
		});
	}

	_transform_order(o) {
		return {
			
		}
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
			assert.equal(data.result, "All orders cancelled");
			return true;
		});
	}

	Trade(side, price, amount, type) {
		let params = {
			symbol: this.symbol,
			price,
			amount,
			side,
			type
		};
		return this.fetch('/v1/order/new', params, 'POST');
	}

	Buy(price, amount) {
		let side = 'buy';
		let type = 'limit';
		if (N.equal(price, -1)) {
			type = 'market';
			price = 1;
		}
		return this.Trade(side, price, amount, type);
	}

	Sell(price, amount) {
		let side = 'sell';
		let type = 'limit';
		if (N.equal(price, -1)) {
			type = 'market';
			price = 1;
		}
		return this.Trade(side, price, amount, type);
	}
}


module.exports = Kraken;
