module.exports = {
	OKEX: require('./exchanges/okex/index.js'),
	BINANCE: require('./exchanges/binance/index.js'),
	BITFINEX: require('./exchanges/bitfinex/index.js'),
	BITFLYER_FX: require('./exchanges/bitflyerfx/index.js'),
	HUOBI: require('./exchanges/huobi/index.js'),

	RateLimiter: require('./lib/rate-limit.js'),
	AutoKiller: require('./lib/auto-kill.js')
};