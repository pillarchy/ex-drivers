const EXCHANGE_REST = require('./bitfinex.rest.js');
const EXCHANGE_WS = require('./bitfinex.ws.js');
const N = require('precise-number');
const { ok } = require('assert');
const wait = require('delay');
const EXCHANGE = require('../exchange.js');

class BITFINEX extends EXCHANGE {
	constructor(options) {
		options = Object.assign({
			Name: 'Bitfinex',
			Fees: {
				Maker: 0.002,
				Taker: 0.002
			},
			RateLimit: 10,
			MinTradeStocks: 0.01,
			Currency: 'BTC',
			BaseCurrency: 'USD'
		}, options);
		super(options);

		this.rest = new EXCHANGE_REST(this.options);

		if (this.options.isWS) {
			this.ws = new EXCHANGE_WS(this.options);
		}
	}

	getHandler() {
		return this.options.isWS ? this.ws : this.rest;
	}

	wsGetAccount() {
		return this.ws.GetAccount();
	}

	async GetAccount() {
		let re = null;
		if (this.options.isWS) {
			if (Date.now() - this.ws.last_time < 1000) {
				re = await this.ws.GetAccount();
				//console.log('ws account returns', re);
			}

			if (!re || re.Stocks === null || re.Balance === null) {
				// console.error('get account info from websocket failed. use rest api instead');
				re = await this.rest.GetAccount();
			}
		} else {
			re = await this.rest.GetAccount();
		}
		return Promise.resolve(re);
	}

	GetAccounts(type = 'exchange') {
		return this.rest.GetAccounts(type);
	}

	GetTicker() {
		return this.rest.GetTicker();
	}

	Buy(price, amount) {
		ok( amount > 0, 'amount should greater than 0');
		if (this.options.always_trade_market) price = -1;
		console.log(this.GetName(), 'Buy', price, amount);
		return this.rest.Buy(price, amount);
	}

	Sell(price, amount) {
		ok( amount > 0, 'amount should greater than 0');
		if (this.options.always_trade_market) price = -1;
		console.log(this.GetName(), 'Sell', price, amount);
		return this.rest.Sell(price, amount);
	}

	waitUntilWSReady() {
		return this.ws.waitUntilWSReady();
	}

	CancelOrder(orderId) {
		return this.rest.CancelOrder(orderId);
	}

	async CancelPendingOrders() {
		let n = 0;
		while ( true ) {
			try {
				await this.rest.CancelAllOrders();
				break;
			} catch ( err ) {
				await wait(n * 1000);
			}
			n++;
			if (n > 20) {
				throw new Error('bitfinex can not cancel all orders');
			}
		}
		return true;
	}

	GetOrders() {
		/**
		 {
			  "id":448411365,
			  "symbol":"btcusd",
			  "exchange":"bitfinex",
			  "price":"0.02",
			  "avg_execution_price":"0.0",
			  "side":"buy",
			  "type":"exchange limit",
			  "timestamp":"1444276597.0",
			  "is_live":true,
			  "is_cancelled":false,
			  "is_hidden":false,
			  "was_forced":false,
			  "original_amount":"0.02",
			  "remaining_amount":"0.02",
			  "executed_amount":"0.0"
		  }
		 */
		return this.rest.GetOrders().then(orders => orders.map(this._transform_order));
	}

	GetOrder(orderId) {
		/*
		{"id":4086524332,"cid":33269813689,"cid_date":"2017-10-01","gid":null,"symbol":"ethusd","exchange":"bitfinex","price":"330.0","avg_execution_price":"300.04","side":"buy","type":"exchange limit","timestamp":"1506849270.0","is_live":false,"is_cancelled":false,"is_hidden":false,"oco_order":null,"was_forced":false,"original_amount":"0.05","remaining_amount":"0.0","executed_amount":"0.05","src":"api"}
		 */
		return this.rest.GetOrder(orderId).then(this._transform_order);
	}

	_transform_order(o) {
		function _order_status(o) {
			let status = 'Unknown';
			if (o.is_live) {
				status = 'Pending';
			} else if (o.is_cancelled) {
				status = 'Cancelled';
			} else if (N.equal(o.original_amount, o.executed_amount)) {
				status = 'Closed';
			}
			return status;
		}

		return {
			Id: o.id,
			Price: N.parse(o.price),
			Amount: N.parse(o.original_amount),
			DealAmount: N.parse(o.executed_amount),
			Type: o.side === 'buy' ? 'Buy' : 'Sell',
			Time: N.parse(o.timestamp),
			Status: _order_status(o)
		};
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

module.exports = BITFINEX;
