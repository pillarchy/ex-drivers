const WebSocket = require('ws');
const EventEmitter = require('events');
const debug = require('debug')('websocket:autoReconnect');

class WebSocketClient extends EventEmitter {

	constructor(url, options) {
		super();
		if (!options) options = {};
		this.autoReconnectInterval = options.autoReconnectInterval || 5000;
		this.msgTimeout = options.msgTimeout || 20000;
		this.url = url;
		this.options = options || {};
		this.msgTimeoutTimer = 0;
		this.open();
		debug('new instance', url, options);
	}

	alive() {
		debug('alive');
		try {
			if (this.msgTimeoutTimer) clearTimeout(this.msgTimeoutTimer);
		} catch (err) { }
		this.msgTimeoutTimer = setTimeout(() => {
			debug('msg timeout');
			this.reconnect();
		}, this.msgTimeout);
	}
	
	open() {

		if (this.pingTimer) clearInterval(this.pingTimer);

		try {
			this.instance = new WebSocket(this.url, this.options);
		} catch (err) {
			console.log('websocket error on new instance', err);
			this.reconnect();
			return;
		}

		this.ping = this.instance.ping.bind(this.instance);

		this.instance.on('open', () => {
			debug('onopen');
			this.alive();
			let pingTime = 0;
			this.pingTimer = setInterval(() => {
				debug('ping');
				pingTime = Date.now();
				try {
					this.instance.ping();
				} catch (err) {}
			}, 10000);
			this.instance.on('pong', () => {
				this.alive();
				let t = Date.now() - pingTime;
				this.emit('pong', t);
				debug('pong', t + 'ms');
			});
			this.emit('open');
		});

		this.instance.on('message', (...args) => {
			this.alive();
			this.emit('message', ...args);
		});

		this.instance.on('close', (e) => {
			debug('close', e);
			this.emit('close', e);
			this.reconnect(e);
		});

		this.instance.on('error', (e) => {
			debug('error', e);
			//this.emit('error', e);
			if (e.code == 'ECONNREFUSED' || e.code == 'ENOTFOUND') {
				this.reconnect(e);
			}
		});
	}

	send(...args) {
		debug('send', ...args);
		try {
			this.instance.send(...args);
		} catch (e) {
			this.instance.emit('error', e);
		}
	}

	reconnect(e) {
		debug('reconnect', e);
		console.log(`WebSocketClient: retry in ${this.autoReconnectInterval}ms`, e);
		this.instance.removeAllListeners();
		setTimeout(() => {
			console.log("WebSocketClient: reconnecting...");
			this.open();
		}, this.autoReconnectInterval);
	}

}


module.exports = WebSocketClient;
