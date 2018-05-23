module.exports = {
	OKEX: require('./exchanges/okex/index.js'),
	BINANCE: require('./exchanges/binance/index.js'),
	BITFINEX: require('./exchanges/bitfinex/index.js'),
	BITFLYER_FX: require('./exchanges/bitflyer_fx/index.js'),
	HUOBI: require('./exchanges/huobi/index.js'),
	ZB: require('./exchanges/zb/index.js'),
	BITTREX: require('./exchanges/bittrex/index.js'),

	RateLimiter: require('./lib/rate-limit.js'),
	AutoKiller: require('./lib/auto-kill.js'),

	ErrorCode: require('./lib/error-code.js')
};