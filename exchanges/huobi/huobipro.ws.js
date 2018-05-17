const WebSocket = require('../../lib/auto-reconnect-ws.js');
const pako = require('pako');
const N = require('precise-number');
const R = require('ramda');
const delay = require('delay');

class HuobiProWs {

	constructor(options) {
		this.connected = false;
		this.alive = false;
		this.options = options;

		this.Currency = options.Currency;
		this.BaseCurrency = options.BaseCurrency;

		this.subscribe();

		this.lastPong = 0;

		setInterval(() => {
			this.checkStatus();
		}, 1000);
	}

	async waitUntilWSReady() {
		let t = Date.now();
		while (!this.connected) {
			let g = Date.now() - t;
			if (g > 10000) throw new Error('huobipro websocket timeout');
			await delay(100);
		}
		return true;
	}

	checkStatus() {
		let t = new Date().getTime();
		if (t - this.lastPong > 30000) {
			this.alive = false;
			console.log('huobipro websocket not available');
			process.exit();
		} else {
			this.alive = true;
		}
	}

	pong() {
		this.lastPong = new Date().getTime();
	}

	_send(data) {
		this.ws.send(JSON.stringify(data));
	}

	subscribe() {
		let socketURL = 'wss://' + this.options.domain + '/ws';
		let ws = new WebSocket(socketURL, {
			pingInterval: 5000
		});
		this.ws = ws;

		ws.on('open', () => {
			this.connected = true;
			console.log('huobipro websocket connected');

			ws.send(JSON.stringify({
				"sub": "market." + this.Currency.toLowerCase() + this.BaseCurrency.toLowerCase() + ".depth.step0",
				"id": "huobiprowsdepthstep0"
			}));
		});

		ws.on('message', data => {
			this.pong();
			try {
				let message_data = pako.ungzip(data, { to: 'string' });
				// console.log(message_data);
				let message = JSON.parse(message_data);
				if (message && (message.ch === "market." + this.Currency.toLowerCase() + this.BaseCurrency.toLowerCase() + ".depth.step0" && message.tick)) {
					this.onDepth(message.tick);
				}

				if (message && message.ping) {
					ws.send(JSON.stringify({pong: message.ping}));
				}
			} catch (e) {
				console.log('huobipro message data error', e);
			}
			
		});

		ws.on('error', (err) => {
			console.log('huobipro websocket error', err);
		});

		ws.on('close', () => {
			this.connected = false;
			console.log('huobipro websocket closed');
		});

		if (this.options.onPong) {
			ws.on('pong', (ms) => {
				this.options.onPong(ms);
			});
		}
	}

	onDepth(data) {
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
			Asks: R.sort( R.descend( R.prop('Price') ), asks).slice(-20),
			Bids: R.sort( R.descend( R.prop('Price') ), bids).slice(0, 20)
		};
		this.options.onDepth(depth);
	}
}


module.exports = HuobiProWs;
