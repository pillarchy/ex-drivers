const WebSocket = require('../../lib/auto-reconnect-ws.js');
const pako = require('pako');
const N = require('precise-number');
const R = require('ramda');
const Events = require('events');
const debug = require('debug')('huobi:ws');

class HUOBI_WS extends Events {

	constructor(options) {
		super();

		this.wsReady = false;
		this.alive = false;
		this.options = options;
		this.symbol = this.options.Currency.toLowerCase() + this.options.BaseCurrency.toLowerCase();

		this.lastPong = 0;

		this.subscribedTickers = {};

		let socketURL = 'wss://' + this.options.domain + '/ws';
		this.ws = new WebSocket(socketURL, {
			pingInterval: 5000
		});

		//remember subscription commands
		this.subscriptionCommands = [];

		if (this.options.onDepth) {
			this.subscriptionCommands.push(JSON.stringify({
				"sub": `market.${this.symbol}.depth.${this.options.DefaultDepthStep}`,
				"id": `huobiprowsdepthstep0${this.symbol}`
			}));
		}

		if (this.options.onTicker) {
			this.subscriptionCommands.push(JSON.stringify({
				sub: `market.${this.symbol}.detail`,
				id: `market${this.symbol}detail`
			}));
		}

		if (this.options.onPublicTrades) {
			this.subscriptionCommands.push(JSON.stringify({
				sub: `market.${this.symbol}.trade.detail`,
				id: `huobiprowspublictrades${this.symbol}`
			}));
		}

		this.ws.on('open', () => {
			console.log('huobipro websocket connected');

			this.subscriptionCommands.map(cmd => {
				debug('<<<', cmd);
				this.ws.send(cmd);
			});
			this.wsReady = true;
			this.emit('connect');
		});

		this.ws.on('message', data => {
			try {
				let message_data = pako.ungzip(data, { to: 'string' });
				debug('>>>', message_data);
				message_data = message_data.replace(/\"id\"\:(\d{15,})/g, '"id":"$1"');
				let message = JSON.parse(message_data);
				this.onMessage(message);
			} catch (e) {
				console.log('huobipro message data error', e);
			}
			
		});

		this.ws.on('error', (err) => {
			console.log('huobipro websocket error', err);
		});

		this.ws.on('close', () => {
			this.wsReady = false;
			console.log('huobipro websocket closed');
			this.emit('close');
		});

		this.ws.on('pong', (ms) => {
			this.lastPong = new Date().getTime();
			if (this.options.onPong) this.options.onPong(ms);
		});
	}

	addSubscription(Currency, BaseCurrency, type) {
		let symbol = String(Currency + BaseCurrency).toLowerCase();
		let sub = '';

		if (type === 'Depth') {
			sub = `market.${symbol}.depth.${this.options.DefaultDepthStep}`;
		} else if (type === 'PublicTrades') {
			sub = `market.${symbol}.trade.detail`;
		} else if (type === 'Ticker') {
			sub = `market.${symbol}.detail`;
		}

		let id = sub.replace(/\./, '');
		let cmd = JSON.stringify({sub, id});
		this.ws.send(cmd);
		this.subscriptionCommands.push(cmd);
	}

	onMessage(data)  {
		if (data && data.ch) {
			if (data.ch.match(/depth\.step/)) {
				this.onDepth(data);
			} else if (data.ch.match(/^market.[^\.]+\.detail$/)) {
				this.onTicker(data);
			} else if (data.ch.match(/trade\.detail/)) {
				this.onPublicTrades(data);
			}
		} else if (data && data.ping) {
			debug('<<<', {pong: data.ping});
			this.ws.send(JSON.stringify({pong: data.ping}));
		}
	}

	_parse_ch(ch, Currency, BaseCurrency) {
		if (!Currency) Currency = this.options.Currency;
		if (!BaseCurrency) BaseCurrency = this.options.BaseCurrency;

		let ms = (ch || '').match(/\b([^\.]+?)(usdt|btc|eth|ht|eos)\b/);
		if (ms && ms[1]) Currency = String(ms[1]).toUpperCase();
		if (ms && ms[2]) BaseCurrency = String(ms[2]).toUpperCase();
		return { Currency, BaseCurrency };
	}

	onDepth(message) {
		let data = message.tick;
		if (!data.asks || !data.bids) return;
		let asks = data.asks.map(pair => {
			return {
				Price: N.parse(pair[0]),
				Amount: N.parse(pair[1])
			};
		});

		let bids = data.bids.map(pair => {
			return {
				Price: N.parse(pair[0]),
				Amount: N.parse(pair[1])
			};
		});

		let depth = {
			Asks: R.sort( R.ascend( R.prop('Price') ), asks),
			Bids: R.sort( R.descend( R.prop('Price') ), bids),
			...this._parse_ch(message.ch)
		};
		this.options.onDepth(depth);
	}


	onTicker(message) {
		/*
		{ ch: 'market.btcusdt.detail',
		  ts: 1530034918376,
		  tick:
		   { amount: 7902.121771417573,
		     open: 6276.98,
		     close: 6171.96,
		     high: 6295.48,
		     id: 10549020806,
		     count: 140880,
		     low: 6122,
		     version: 10549020806,
		     vol: 49101237.06820304 } }
		 */

		let { ch, ts, tick: ticker } = message;
		if (!ch || !ts || !ticker) return;

		let Time = N.parse(ts);
		this.options.onTicker({
			Buy: N.parse(ticker.close),
			Sell: N.parse(ticker.close),
			High: N.parse(ticker.high),
			Last: N.parse(ticker.close),
			Low: N.parse(ticker.low),
			Volume: N.parse(ticker.vol),
			Time,
			...this._parse_ch(ch),
			Info: ticker
		});
	}

	onPublicTrades(message) {
		/*
			{"ch":"market.btcusdt.trade.detail","ts":1530034318494,"tick":{"id":10548310937,"ts":1530034318456,"data":[{"amount":0.001900000000000000,"ts":1530034318456,"id":105483109376614204685,"price":6173.870000000000000000,"direction":"buy"},{"amount":0.036100000000000000,"ts":1530034318456,"id":105483109376614204779,"price":6173.870000000000000000,"direction":"buy"},{"amount":0.026500000000000000,"ts":1530034318456,"id":105483109376614205431,"price":6173.870000000000000000,"direction":"buy"},{"amount":0.026500000000000000,"ts":1530034318456,"id":105483109376614205801,"price":6173.870000000000000000,"direction":"buy"},{"amount":0.010000000000000000,"ts":1530034318456,"id":105483109376614209326,"price":6173.870000000000000000,"direction":"buy"}]}}
		 */
		let { ch, tick: { data: trades } } = message;
		if (!ch || !trades) return;

		if (trades && trades.length > 0) {
			trades = trades.map(t => ({
				Amount: N.parse(t.amount),
				Price: N.parse(t.price),
				Type: t.direction === 'buy' ? 'Buy' : 'Sell',
				Time: Math.floor(t.ts),
				Id: t.id,
				...this._parse_ch(ch)
			}));
			this.options.onPublicTrades(trades);
		}
	}

}


module.exports = HUOBI_WS;
