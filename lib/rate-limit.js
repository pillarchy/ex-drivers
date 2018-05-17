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

	constructor(period, limitedRequests) {
		this.period = period;
		this.limitedRequests = limitedRequests;
		this.history = [];
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
		while (this.check()) {
			debug('rate limited');
			await wait( Math.ceil( (this.period * 0.5) / this.limitedRequests) );
		}
	}
}

module.exports = RateLimiter;