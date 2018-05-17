const EXCHANGE_REST = require('./kraken.rest.js');
const N = require('precise-number');
const { ok, equal } = require('assert');

class EXCHANGE {
	constructor(options) {
		if (!options.Currency) options.Currency = 'BTC';
		this.Currency = options.Currency;
		this.options = options;
		this.rest = new EXCHANGE_REST(options);

	
		this.fee = {
			BuyMaker: 0.2,
			SellMaker: 0.2,
			BuyTaker: 0.2,
			SellTaker: 0.2
		};
	}

	SetFee(fee) {
		ok(fee, 'no fee');
		ok(fee.BuyMaker);
		ok(fee.BuyTaker);
		ok(fee.SellMaker);
		ok(fee.BuyMaker);
		this.fee = fee;
	}

	GetFee() {
		return this.fee;
	}

	GetName() {
		return this.options.Name ? this.options.Name : 'Kraken';
	}

	getHandler() {
		return this.rest;
	}

	GetAccount() {
		return this.getHandler().GetAccount();
	}

	GetTicker() {
		return this.rest.GetTicker();
	}

	GetMin() {
		return 0.01;
	}

	Buy(price, amount) {
		ok( amount > 0, 'amount should greater than 0');
		console.log(this.GetName(), 'Buy', price, amount);
		return this.getHandler().Buy(price, amount).then( r=> {
			if (r && r.result && r.order_id) {
				return r.order_id;
			} else {
				throw new Error(r);
			}
		});
	}

	Sell(price, amount) {
		ok( amount > 0, 'amount should greater than 0');
		console.log(this.GetName(), 'Sell', price, amount);
		return this.getHandler().Sell(price, amount).then( r=> {
			if (r && r.result && r.order_id) {
				return r.order_id;
			} else {
				throw new Error(r);
			}
		});
	}

	CancelOrder(orderId) {
		return this.getHandler().CancelOrder(orderId).then(result=>{
			if (result && (result.result == true || result.result == 'true')) return true;
			throw new Error('cancel order failed, result: '+JSON.stringify(result));
		});
	}

	CancelPendingOrders() {
		console.log('cancelling pending orders...');
		return this.GetOrders().then( orders=>{
			console.log('cancelling',orders.length,'orders');
			return Promise.all(orders.map( o=> {
				return this.CancelOrder(o.Id);
			})).then( results=>{
				console.log(results);
				return true;
			});
		});
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
		return this.rest.GetOrder(orderId).then(this._transform_order);
	}

	_transform_order(o) {
		function _order_status(o) {
			let status = 'Unknown';
			if (o.is_live) {
				status = 'Pending';
			} else if (o.is_cancelled) {
				status = 'Cancelled';
			} else if (o.is_hidden) {
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


module.exports = EXCHANGE;
