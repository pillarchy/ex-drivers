const N = require('precise-number');
const { ok } = require('assert');
const WebSocket = require('../../lib/auto-reconnect-ws.js');
const R = require('ramda');
const sha1 = require('sha1');
const crypto = require('crypto');
const delay = require('delay');
const debug = require('debug')('exchange:zb:ws');
const Events = require('events');
const ExError = require('../../lib/error');
const ErrorCode = require('../../lib/error-code');

class ZB_WS extends Events {
	constructor(options) {
		super();
		this.options = options;

		this.symbol = this.options.Currency.toLowerCase() + this.options.BaseCurrency.toLowerCase();
		this.history = [];

		this.ws = new WebSocket('wss://api.bitkk.com:9999/websocket');

		this.symbols = {};
		this.symbols[this.symbol] = {
			Currency: this.options.Currency,
			BaseCurrency: this.options.BaseCurrency
		};

		//remember subscription commands
		this.subscriptionCommands = [];

		if (this.options.onDepth) {
			this.subscriptionCommands.push(JSON.stringify({
				event: 'addChannel',
				channel: this.symbol + '_depth'
			}));
		}

		if (this.options.onTicker) {
			this.subscriptionCommands.push(JSON.stringify({
				event: 'addChannel',
				channel: this.symbol + '_ticker'
			}));
		}

		if (this.options.onPublicTrades) {
			this.subscriptionCommands.push(JSON.stringify({
				event: 'addChannel',
				channel: this.symbol + '_trades'
			}));
		}

		this.wsReady = false;
		this.ws.on('open', () => {
			this.subscriptionCommands.map(cmd => {
				this.ws.send(cmd);
			});
			this.wsReady = true;
			this.emit('connect');
		});

		this.ws.on('message', (data) => {
			debug('msg got', data);
			this.wsReady = true;
			this.onMessage(data);
		});

		this.ws.on('pong', t => {
			this.wsReady = true;
			if (this.options.onPong) {
				this.options.onPong(t);
			}
		});

		this.ws.on('close', () => {
			this.emit('close');
		});

		this.tmpHandlers = {};
	}

	onMessage(raw)  {
		let data = null;
		try {
			if (raw) {
				raw = raw.replace(/\"entrustId\"\:\s*(\d+)/, '"entrustId":"$1"');
			}
			data = JSON.parse(raw);
		} catch (err) {
			console.error('zb.com websocket message error: ' + raw);
			return;
		}
		if (!data) return;

		if (data.dataType === 'depth') {
			this.onDepth(data);
		} else if (data.dataType === 'ticker') {
			this.onTicker(data);
		} else if (data.dataType === 'trades') {
			this.onPublicTrades(data);
		} else {
			this.handleOnce(data);
		}
	}

	addSubscription(Currency, BaseCurrency, type) {
		let symbol = String(Currency + BaseCurrency).toLowerCase();
		this.symbols[symbol] = {
			Currency,
			BaseCurrency
		};
		let cmd = JSON.stringify({
			event: 'addChannel',
			channel: String(symbol + '_' + type).toLowerCase()
		});
		this.ws.send(cmd);
		this.subscriptionCommands.push(cmd);
	}

	onDepth(data) {
		let { asks, bids, channel, timestamp } = data;
		if (!asks || !bids || !channel || !timestamp) return;

		channel = channel.replace(/\_\w+/, '');
		let info = this.symbols[channel];
		if (!info) return;

		asks = asks.map(pair => {
			return {
				Price: N.parse(pair[0]),
				Amount: N.parse(pair[1])
			};
		});

		bids = bids.map(pair => {
			return {
				Price: N.parse(pair[0]),
				Amount: N.parse(pair[1])
			};
		});

		let depth = {
			Time: Math.round(timestamp * 1000),
			Asks: R.sort( R.ascend( R.prop('Price') ), asks),
			Bids: R.sort( R.descend( R.prop('Price') ), bids),
			...info
		};

		this.options.onDepth(depth);
	}

	onTicker(data) {
		let { date, channel, ticker } = data;
		if (!date || !channel || !ticker) return;

		channel = channel.replace(/\_\w+/, '');
		let info = this.symbols[channel];
		if (!info) return;

		this.options.onTicker({
			Buy: N.parse(ticker.buy),
			Sell: N.parse(ticker.sell),
			High: N.parse(ticker.high),
			Last: N.parse(ticker.last),
			Low: N.parse(ticker.low),
			Volume: N.parse(ticker.vol),
			Time: N.parse(date),
			...info
		});
	}

	onPublicTrades(data) {
		/*
		{ dataType: 'trades',
		  data:
		   [ { amount: '0.0011',
		       price: '44273.49',
		       tid: 103779201,
		       date: 1529603755,
		       type: 'buy',
		       trade_type: 'bid' },
		     { amount: '0.0099',
		       price: '44286.41',
		       tid: 103779202,
		       date: 1529603755,
		       type: 'buy',
		       trade_type: 'bid' },
		     { amount: '0.0061',
		       price: '44293.53',
		       tid: 103779203,
		       date: 1529603755,
		       type: 'buy',
		       trade_type: 'bid' } ],
		  channel: 'btcqc_trades' }
		 */
		let { channel } = data;
		if (!channel) return;

		channel = channel.replace(/\_\w+/, '');
		let info = this.symbols[channel];
		if (!info) return;

		let trades = data.data;
		if (!trades) return;

		if (trades && trades.length > 0) {
			trades = trades.map(t => ({
				Amount: N.parse(t.amount),
				Price: N.parse(t.price),
				Type: t.type === 'buy' ? 'Buy' : 'Sell',
				Time: Math.floor(t.date * 1000),
				Id: t.tid,
				...info
			}));
		}
		this.options.onPublicTrades(trades);
	}

	handleOnce(data) {
		if (data && data.channel && data.no) {
			let key = data.channel + ',' + data.no;
			if (this.tmpHandlers[key]) {
				this.tmpHandlers[key](data);
				delete(this.tmpHandlers[key]);
				return true;
			}
		}
		return false;
	}

	once(channel, no) {
		return new Promise((done, reject) => {
			let expired = false;
			let timer = setTimeout(() => {
				expired = true;
				let err = new ExError(ErrorCode.REQUEST_TIMEOUT, 'zb websocket api for ' + channel + ' expired');
				err.type = 'request-timeout';
				reject(err);
			}, 5000);
			let key = channel + ',' + no;
			this.tmpHandlers[key] = (data) => {
				if (expired) return;
				try { clearTimeout(timer); } catch (err) {}
				done(data);
			};
		});
	}

	async request(params) {
		await this.options.rateLimiter.wait();
		let no = Date.now() + '' + Math.random().toString().replace(/\./g, '');
		let channel = params.channel;
		if (!channel) throw new Error("no channel");

		params.accesskey = this.options.Key;
		params.no = no;
		params.event = 'addChannel';
		params.sign = sign(params, this.options.Secret);

		// console.log(params);
		this.ws.send(JSON.stringify(params));

		return this.once(channel, no).then(data => {
			if (data && data.success === false) {
				throw data;
			}

			if (data && data.data && typeof data.data === 'string') {
				let s = data.data.replace(/\b([a-zA-Z\_]+)\:/g, '"$1":').replace(/\:([^\,\"\'\[\]\{\}]+)/g, ':"$1"');
				data.data = JSON.parse(s);
			}

			return data && data.data ? data.data : data;
		});
	}

	GetAccount() {
		return this.request({
			channel: 'getaccountinfo'
		}).then(data => {
			data.route = 'websocket';
			return data;
		});
	}

	_getSymbol(Currency, BaseCurrency) {
		let c = Currency || this.options.Currency;
		let bc = BaseCurrency || this.options.BaseCurrency;
		return c.toLowerCase() + bc.toLowerCase();
	}

	Trade(type, price, amount, Currency, BaseCurrency) {
		ok( amount > 0, 'amount should greater than 0');

		return this.request({
			amount,
			channel: `${this._getSymbol(Currency, BaseCurrency)}_order`,
			price,
			tradeType: type === 'Sell' ? 0 : 1
		}).then(o => {
			if (o && o.entrustId) return o.entrustId;
			throw o;
		});
	}

	async waitUntilWSReady() {
		let t = Date.now();
		while (!this.wsReady) {
			let g = Date.now() - t;
			if (g > 30000) throw new Error('zb websocket timeout');
			await delay(100);
		}
		return true;
	}

	CancelOrder(orderId, Currency, BaseCurrency) {
		return this.request({
			channel: `${this._getSymbol(Currency, BaseCurrency)}_cancelorder`,
			id: orderId
		}).then(a => a && a.success);
	}

	GetOrder(orderId, Currency, BaseCurrency) {
		return this.request({
			channel: `${this._getSymbol(Currency, BaseCurrency)}_getorder`,
			id: orderId
		});
	}

	_order_type( type ) {
		//buy_market:市价买入 / sell_market:市价卖出
		type = type.toString();
		let arr = {
			'buy_market':'Buy',
			'sell_market': 'Sell',
			'buy': 'Buy',
			'sell': 'Sell'
		};
		return arr[type];
	}

}

function sign(params, secret) {
	let obj = {};
	Object.keys(params).sort().map(key => {
		obj[key] = params[key];
	});
	secret = sha1(secret);
	return hash_hmac(JSON.stringify(obj), secret);
}

function hash_hmac(data, key) {
	const hmac = crypto.createHmac('md5', key);
	hmac.update(data);
	return hmac.digest('hex');
}

module.exports = ZB_WS;
