const ws = require('ws');
const N = require('precise-number');
const R = require("ramda");
const BFX = require('bitfinex-api-node');

function wait(ms) {
	return new Promise( d => setTimeout(d, ms) );
}

class Bitfinex {

	constructor(options) {
		this.key = options.WSKey;
		this.secret = options.WSSecret;
		if (!this.key || !this.secret) throw new Error('Bitfinex websocket mode need WSKey and WSSecret in options');

		if (!options.Currency) options.Currency = 'BTC';
		this.options = options;
		this.symbol = options.Currency.toLowerCase()+'usd';

		const opts = {
			version: 2,
			transform: true
		};

		this.ws = new BFX(this.key, this.secret, opts).ws;

		this.ws.on('auth', () => {
			console.log('authenticated')
		});

		this.ws.on('message', () => {

		});

		this.ws.on('open', () => {
			this.ws.subscribeOrderBook(this.symbol.toUpperCase(), 'P0')
			this.ws.auth();
		});

		this.ws.on('orderbook', (pair, book) => {
			this.last_time = Date.now();
			this.onOrderBookUpdate(book);
		});

		this.ws.on('error', console.error);

		this.orderbook = {};

		this.ws_ready = false;

		this.last_time = 0;

		this.account = {
			Stocks: null,
			Balance: null,
			FrozenBalance: 0,
			FrozenStocks: 0
		};

		this.ws.on('wu', (data) => {
			/*
			WALLET_TYPE	string	Wallet name (exchange, margin, funding)
			CURRENCY	string	Currency (fUSD, etc)
			BALANCE	float	Wallet balance
			UNSETTLED_INTEREST	float	Unsettled interest
			BALANCE_AVAILABLE	float / null	Amount not tied up in active orders, positions or funding (null if the value is not fresh enough).
			 */
			let [WALLET_TYPE, CURRENCY, BALANCE, UNSETTLED_INTEREST, BALANCE_AVAILABLE] = data;
			if (WALLET_TYPE === 'exchange') {
				if (CURRENCY === 'USD') {
					this.account.Balance = N.parse(BALANCE);
				} else if (CURRENCY === this.options.Currency) {
					this.account.Stocks = N.parse(BALANCE);
				}

				if (typeof options.onAccount === 'function') {
					options.onAccount(this.account);
				}
			}

			this.last_time = Date.now();
		});

		this.ws.on('tu', () => {
			this.last_time = Date.now();
		});

		this.ws.on('te', () => {
			this.last_time = Date.now();
		});

		this.ws.on('auth', () => {
			this.ws_ready = true;
		});

	}

	waitUntilWSReady() {
		if (this.ws_ready) return Promise.resolve(true);

		return new Promise( async (done, reject) => {

			let timer = setTimeout( () => {
				reject('bitfinex websocket connection timeout');
				process.exit();
			}, 60000);

			while(true) {
				await wait(100);
				if (this.ws_ready) break;
			}

			clearTimeout(timer);
			done();
		});
	}

	onInfo(...args) {
		console.log('on info', ...args);
	}

	GetAccount() {
		return Promise.resolve(this.account);
	}

	onOrderBookUpdate(data) {

		// console.log(data);
		if (Array.isArray(data)) {
			data.map(r => {
				if (r && r.PRICE && r.AMOUNT) {
					this.orderbook[r.PRICE+''] = r.AMOUNT;
				}
			})
		} else {
			if (data && data.PRICE && data.AMOUNT) {

				if (data.COUNT*1 == 0) {
					delete(this.orderbook[data.PRICE+'']);
				} else {
					if (data.AMOUNT*1 > 0) {
						Object.keys(this.orderbook).map(price => {
							let amount = this.orderbook[price]*1;
							if (amount < 0 && price*1 < data.PRICE*1) {
								delete(this.orderbook[price]);
							}
						});
					} else {
						Object.keys(this.orderbook).map(price => {
							let amount = this.orderbook[price]*1;
							if (amount > 0 && price*1 > data.PRICE*1) {
								delete(this.orderbook[price]);
							}
						});
					}
					this.orderbook[data.PRICE+''] = data.AMOUNT;
				}
			}
		}

		//clean
		let asks = [], bids = [];
		Object.keys(this.orderbook).map(price => {
			let amount = this.orderbook[price];
			if (amount > 0) {
				bids.push({
					Price: N.parse(price),
					Amount: N.parse(amount)
				});
			} else {
				asks.push({
					Price: N.parse(price),
					Amount: N.parse(amount*-1)
				});
			}
		});

		asks = R.sort( R.ascend( R.prop('Price') ), asks);
		bids = R.sort( R.descend( R.prop('Price') ), bids);
		
		if (asks.length > 30) asks = asks.slice(0, 30); 
		if (bids.length > 30) bids = bids.slice(0, 30);

		let orders = {};
		asks.map(r=>{
			orders[r.Price+''] = -1*r.Amount;
		});
		bids.map(r=>{
			orders[r.Price+''] = r.Amount;
		});
		this.orderbook = orders;

		if (typeof this.options.onDepth === 'function') {
			this.options.onDepth({
				Asks: R.sort( R.descend( R.prop('Price') ), asks),
				Bids: bids
			});
		}
	}



}

module.exports = Bitfinex;