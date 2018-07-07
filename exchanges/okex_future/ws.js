const N = require('precise-number');
const WebSocket = require('../../lib/auto-reconnect-ws.js');
const moment = require('moment');
const R = require('ramda');
const { md5 }  = require('utility');
const Events = require('events');
const clor = require('clor');

class OKEX_FUTURE_WS extends Events {
	constructor(options) {
		super();
		this.options = options;

		this.lastPingTime = Date.now();

		this.symbol = this.options.Currency.toLowerCase() + '_' + this.options.BaseCurrency.toLowerCase();

		this.ws = new WebSocket('wss://real.okex.com:10440/websocket/okexapi');

		//remember subscription commands
		this.subscriptionCommands = [];

		let loginParams = {api_key: this.options.Key};
		loginParams.sign = sign(loginParams, this.options.Secret);
		this.subscriptionCommands.push(JSON.stringify({
			event: 'login',
			parameters: loginParams
		}).replace(/\"/g, "'"));

		if (this.options.onDepth) {
			this.subscriptionCommands.push(JSON.stringify({
				event: 'addChannel',
				channel: `ok_sub_futureusd_${this.options.Currency.toLowerCase()}_depth_${this.options.DefaultContactType.toLowerCase()}_20`
			}).replace(/\"/g, "'"));
		}

		if (this.options.onTicker) {
			this.subscriptionCommands.push(JSON.stringify({
				event: 'addChannel',
				channel: `ok_sub_futureusd_${this.options.Currency.toLowerCase()}_ticker_${this.options.DefaultContactType.toLowerCase()}`
			}).replace(/\"/g, "'"));
		}

		if (this.options.onPublicTrades) {
			this.subscriptionCommands.push(JSON.stringify({
				event: 'addChannel',
				channel: `ok_sub_futureusd_${this.options.Currency.toLowerCase()}_trade_${this.options.DefaultContactType.toLowerCase()}`
			}).replace(/\"/g, "'"));
		}

		this.wsReady = false;
		this.ws.on('open', () => {
			this.subscriptionCommands.map(cmd => {
				this.ws.send(cmd);
			});
			this.emit('connect');
		});

		this.ws.on('message', (data) => {
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
			this.wsReady = false;
		});

		this.ws.on('error', () => {
			this.emit('close');
			this.wsReady = false;
		});

		setInterval(() => {
			if (this.wsReady) {
				this.lastPingTime = Date.now();
				this.ws.send("{'event':'ping'}");
			}
		}, 5000);
	}

	onMessage(raw)  {
		let messages = null;
		try {
			messages = JSON.parse(raw);
		} catch (err) {
			console.error('okex websocket message error: ' + raw);
			return;
		}
		if (!messages) return;

		if (messages && messages.event === 'pong') {
			this.onPong();
			return;
		}

		messages.forEach(message => {
			if (message.channel === 'login') {
				if (message.data && message.data.result) {
					console.log(clor.green('okex websocket login success').toString());
					this.wsReady = true;
					this.emit('connect');
				} else {
					console.error(clor.red('okex websocket login faild').toString(), message);
					process.exit();
					return;
				}
				return;
			}

			let { channel, data } = message;
			if (!channel || !data) return;
			if (channel.match(/\_ticker\_/)) {
				this.onTicker(message);
			} else if (channel.match(/^ok\_sub\_futureusd\_.+?\_depth/)) {
				this.onDepth(message);
			} else if (channel.match(/^ok\_sub\_futureusd\_.+?\_trade/)) {
				this.onPublicTrades(message);
			}
		});
	}

	onPong() {
		let gap = Date.now() - this.lastPingTime;
		console.log('okex websocket ping pong time:', gap + 'ms');
		this.lastPong = Date.now();
	}

	addSubscription(Currency, BaseCurrency, type, ContractType) {
		if (!Currency) Currency = this.options.Currency;
		if (!BaseCurrency) BaseCurrency = this.options.BaseCurrency;
		if (!ContractType) ContractType = this.options.DefaultContactType;

		let channel = '';
		if (type === 'Ticker') {
			channel = `ok_sub_futureusd_${Currency}_ticker_${ContractType}`.toLowerCase();
		} else if (type === 'Depth') {
			channel = `ok_sub_futureusd_${Currency}_depth_${ContractType}_20`.toLowerCase();
		} else if (type === 'PublicTrades') {
			channel = `ok_sub_futureusd_${Currency}_trade_${ContractType}`.toLowerCase();
		}
		
		if (!channel) throw new Error('unkown subscription type: ' + type);

		let cmd = JSON.stringify({
			event: 'addChannel',
			channel
		}).replace(/\"/g, "'");

		this.ws.send(cmd);
		this.subscriptionCommands.push(cmd);
	}

	onDepth(data) {
		let { channel, data: {timestamp, asks, bids } } = data;
		if (!asks || !bids || !channel || !timestamp) return;

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
			...this._parse_ch(channel)
		};

		this.options.onDepth(depth);
	}

	_parse_ch(ch) {
		if (!ch) ch = '';
		ch = ch.replace(/^ok_sub_future/i, '');
		let ms = ch.match(/^usd\_([0-9a-z]+)/);
		let ms2 = ch.match(/(quarter|this_week|nex_week)/);
		let ContractType = ms2 && ms2[1] ? ms2[1] : this.options.DefaultContactType;
		if (ms && ms[1]) {
			return {
				Currency: String(ms[1]).toUpperCase(),
				BaseCurrency: 'USD',
				ContractType
			};
		} else {
			return {
				Currency: this.options.Currency,
				BaseCurrency: this.options.BaseCurrency,
				ContractType
			};
		}
	}

	onTicker({channel, data}) {
		if (!data || !channel) return;

		/*
		{ high: '0.05612832',
		  vol: '128795.274296',
		  last: '0.05586972',
		  low: '0.05350554',
		  buy: '0.0557892',
		  change: '0.00090871',
		  sell: '0.05595013',
		  dayLow: '0.05350554',
		  close: '0.05586972',
		  dayHigh: '0.05612832',
		  open: '0.05496101',
		  timestamp: 1522904232875 }
		 */
		let re = {
			Open: N.parse(data.open),
			High: N.parse(data.high),
			Low: N.parse(data.low),
			Close: N.parse(data.close),
			Buy: N.parse(data.buy),
			Sell: N.parse(data.sell),
			Volume: N.parse(data.vol),
			Time: N.parse(data.timestamp),
			...this._parse_ch(channel),
			Info: data
		};
		if (this.options.onTicker) {
			this.options.onTicker(re);
		}
	}

	onPublicTrades(data) {
		let { channel, data: trades } = data;
		if (!channel || !trades || trades.length <= 0) return;

		let baseTime = moment().format('YYYY-MM-DD') + ' ';
		trades = trades.map(t => ({
			Amount: N.parse(t[2]),
			Price: N.parse(t[1]),
			Type: t[4] === 'bid' ? 'Buy' : 'Sell',
			Time: moment(baseTime + t[3]).format('x') * 1,
			Id: t[0],
			...this._parse_ch(channel)
		}));
		this.options.onPublicTrades(trades);
	}
}

function sign(params, secret) {
	return md5(stringifyTookexFormat(params) + '&secret_key=' + secret).toUpperCase();
}

function stringifyTookexFormat(obj) {
	let arr = [],
		i,
		formattedObject = '';

	for (i in obj) {
		if (obj.hasOwnProperty(i)) {
			arr.push(i);
		}
	}
	arr.sort();
	for (i = 0; i < arr.length; i++) {
		if (i !== 0) {
			formattedObject += '&';
		}
		formattedObject += arr[i] + '=' + obj[arr[i]];
	}
	return formattedObject;
}

module.exports = OKEX_FUTURE_WS;
