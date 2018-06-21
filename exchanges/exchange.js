const { ok } = require('assert');
const wait = require('delay');
const RateLimiter = require('../lib/rate-limit');

class EXCHANGE {
	
	constructor(options) {
		if (!options) options = {};
		ok(options.Currency, 'no Currency in options');
		ok(options.BaseCurrency, 'no BaseCurrency in options');
		ok(options.Name, 'no Name in options');
		ok(options.Fees, 'no Fees in options');
		ok(options.Key, 'no Key in options');
		ok(options.Secret, 'no Secret in options');

		options = Object.assign({
			RateLimit: 10,
			RateLimitInterval: 1000
		}, options);

		if (!options.rateLimiter && options.RateLimit && options.RateLimitInterval) {
			options.rateLimiter = new RateLimiter(options.RateLimitInterval, options.RateLimit);
		}

		this.options = options;
		this.wsReady = false;
	}

	/**
	 * wait websocket ready
	 */
	async waitUntilWSReady() {
		if (!this.options.isWS) return true;
		let startTime = Date.now();
		while (!this.wsReady) {
			await wait(200);
			if (Date.now() - startTime > 30000) {
				throw new Error(this.GetName() + ' websocket timeout');
			}
		}
		return true;
	}

	/**
	 * set maker and taker fees
	 */
	SetFee(fee) {
		ok(fee, 'no fee');
		ok(fee.Maker);
		ok(fee.Taker);
		this.options.Fees = fee;
	}

	/**
	 * get maker and taker fees
	 */
	GetFee() {
		return this.options.Fees;
	}

	/**
	 * get exchange name
	 */
	GetName() {
		return this.options.Name || 'Unkown Exchange';
	}

	/**
	 * get the minimum trade amount
	 */
	GetMin() {
		return this.options.MinTradeAmount || 0.01;
	}
}


module.exports = EXCHANGE;
