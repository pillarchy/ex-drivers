const N = require('precise-number');
const { ok, equal } = require('assert');
const WebSocket = require('../../lib/auto-reconnect-ws.js');
const R = require('ramda');
const sha1 = require('sha1');
const crypto = require('crypto');
const delay = require('delay');
const debug = require('debug')('exchange:zb:ws');
const clor = require("clor");
const wait = require('delay');

class EXCHANGE {
	constructor(options) {
		if (!options.Currency) options.Currency = 'BTC';
		if (!options.BaseCurrency) options.BaseCurrency = 'USDT';

		this.Currency = options.Currency;
		this.BaseCurrency = options.BaseCurrency;

		this.options = options;

		if (!this.options.rateLimiter) throw 'No rateLimiter in options';

		this.symbol = this.Currency.toLowerCase() + this.BaseCurrency.toLowerCase();
		this.requestLimitPeriod = 1000;
		this.requestLimit = 13;
		this.history = [];

		this.ws = new WebSocket('wss://api.bitkk.com:9999/websocket');

		this.wsReady = false;
		this.ws.on('open', () => {

			if (this.options.onDepth) {
				this.ws.send(JSON.stringify({
					event: 'addChannel',
					channel: this.symbol + '_depth'
				}));
			}

			if (this.options.onTicker) {
				this.ws.send(JSON.stringify({
					event: 'addChannel',
					channel: this.symbol + '_ticker'
				}));
			}

			if (this.options.onTrades) {
				this.ws.send(JSON.stringify({
					event: 'addChannel',
					channel: this.symbol + '_trades'
				}));
			}

			this.wsReady = true;

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
			this.onTrades(data);
		} else {
			this.handleOnce(data);
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
			Asks: R.sort( R.ascend( R.prop('Price') ), asks),
			Bids: R.sort( R.descend( R.prop('Price') ), bids)
		};

		this.options.onDepth(depth);
	}

	onTicker(data) {
		if (!data.ticker) return;
		let t = data.ticker;
		this.options.onTicker({
			Buy: N.parse(t.buy),
			Sell: N.parse(t.sell),
			High: N.parse(t.high),
			Last: N.parse(t.last),
			Low: N.parse(t.low),
			Volume: N.parse(t.vol)
		});
	}

	onTrades(data) {
		/*
		{ amount: '0.010',
		    price: '689.37',
		    tid: 2395393,
		    type: 'buy',
		    date: 1513263322,
		    trade_type: 'bid' },
		 */
		if (!data.data) return;
		let trades = data.data;
		if (trades && trades.length > 0) {
			trades = trades.map(t => ({
				Amount: N.parse(t.amount),
				Price: N.parse(t.price),
				Type: t.type === 'buy' ? 'Buy' : 'Sell',
				Time: Math.floor(t.date * 1000),
				Id: t.tid
			}));
		}
		this.options.onTrades(trades);
	}

	GetName() {
		return this.options.Name ? this.options.Name : 'ZB';
	}

	handleOnce(data) {
		if (data && data.channel && data.no) {
			let key = data.channel + ',' + data.no;
			if (this.tmpHandlers[key]) {
				this.tmpHandlers[key](data);
				delete(this.tmpHandlers[key]);
			}
		}
	}

	once(channel, no) {
		return new Promise((done, reject) => {
			let expired = false;
			let timer = setTimeout(() => {
				expired = true;
				reject('zb websocket api for ' + channel + ' expired');
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

		let re = null;
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
		});
	}

	GetMin() {
		return 0.01;
	}

	_getSymbol(currency) {
		return (!currency) ? this.symbol : currency.toLowerCase() + this.BaseCurrency.toLowerCase();
	}

	_trade(tradeType, price, amount, currency) {
		ok( amount > 0, 'amount should greater than 0');

		return this.request({
			amount,
			channel: `${this._getSymbol(currency)}_order`,
			price,
			tradeType
		}).then(o => {
			if (o && o.entrustId) return o.entrustId;
			throw o;
		});
	}

	Buy(price, amount, currency) {
		return this._trade(1, price, amount, currency);	
	}

	Sell(price, amount, currency) {
		return this._trade(0, price, amount, currency);
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

	CancelOrder(orderId) {
		return this.request({
			channel: `${this.symbol}_cancelorder`,
			id: orderId
		}).then(a => a && a.success);
	}

	async CancelPendingOrders() {
		let n = 0;
		while ( true ) {
			try {
				let a = await this.rest.CancelAllOrders();
				break;
			} catch ( err ) {
				await wait(n * 1000);
			}
			n++;
			if (n > 20) {
				throw new Error('zb can not cancel all orders');
			}
		}
		return true;
	}

	GetOrders(page) {
		return this.request({
			channel: `${this.symbol}_getordersignoretradetype`,
			pageIndex: page || 1,
			pageSize: 100
		}).then(re => {
			// console.log(re);
			if (!re || re.success === false) {
				throw JSON.stringify(re);
			}
			return re;
		}).then(orders => orders.map(this._transform_order)).then(arr => {
			return arr.filter(o => (o.Status === 'Pending' || o.Status === 'Partial'));
		});
	}

	GetOrder(orderId) {
		/*
		{"id":4086524332,"cid":33269813689,"cid_date":"2017-10-01","gid":null,"symbol":"ethusd","exchange":"bitfinex","price":"330.0","avg_execution_price":"300.04","side":"buy","type":"exchange limit","timestamp":"1506849270.0","is_live":false,"is_cancelled":false,"is_hidden":false,"oco_order":null,"was_forced":false,"original_amount":"0.05","remaining_amount":"0.0","executed_amount":"0.05","src":"api"}
		 */
		return this.request({
			channel: `${this.symbol}_getorder`,
			id: orderId
		}).then(this._transform_order);
	}

	_transform_order(o) {
		/*
		{ currency: 'btcusdt',
		    id: '201712127040792',
		    price: '13000.0',
		    status: '0',
		    total_amount: '0.01',
		    trade_amount: '0.0',
		    trade_date: '1513063121871',
		    trade_money: '0.000000',
		    trade_price: '0',
		    type: '1' },
		 */
		function _order_status(o) {
			//(0：待成交,1：取消,2：交易完成,3：待成交未交易部份)
			switch (o) {
					case 0: return 'Pending';
					case 1: return 'Cancelled';
					case 2: return 'Closed';
					case 3: return 'Partial';
					default: return 'Unknown';
			}
		}

		let re = {
			Id: o.id,
			Price: N.parse(o.price),
			Amount: N.parse(o.total_amount),
			DealAmount: N.parse(o.trade_amount),
			Type: (o.type && o.type * 1 === 1) ? 'Buy' : 'Sell',
			Time: N.parse(o.trade_date),
			Status: _order_status(o.status * 1)
		};

		if (re.DealAmount === 0 && re.Status === 'Partial') re.Status = 'Pending';

		return re;
	}

	GetDepth(size, merge) {
		return this.rest.GetDepth(size, merge);
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
module.exports = EXCHANGE;
