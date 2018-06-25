const wait = require('delay');
const debug = require('debug')('rate');

/**
 * rate limiter
 * usage:
 *
 * const limiter = new RateLimiter(1000, 5);
 *
 * while(true) {
 * 		await limiter.wait();
 * 		console.log(new Date());
 * }
 */

class RateLimiter {

	constructor(period, limitedRequests, throwWhenLimited = false) {
		this.period = period;
		this.limitedRequests = limitedRequests;
		this.history = [];
		this.throw = throwWhenLimited;
	}

	check() {
		let startTime = Date.now() - this.period;
		let cnt = this.history.filter(t => t >= startTime).length;
		if (cnt >= this.limitedRequests) {
			return true;
		}

		this.history.push(Date.now());

		while (this.history.length > this.limitedRequests * 2) this.history.shift();

		return false;
	}

	async wait() {
		let startTime = Date.now();
		while (this.check()) {
			debug('rate limited');
			if (this.throw) {
				let err = new Error(`rate limit reached for ${this.limitedRequests} requests in ${this.period}ms`);
				err.code = 'RATE_LIMITED';
				throw err;
			}
			await wait( Math.ceil( (this.period * 0.5) / this.limitedRequests) );
		}
		return Date.now() - startTime;
	}
}

module.exports = RateLimiter;