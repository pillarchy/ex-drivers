
const EXCHANGE_REST = require('./huobipro.rest.js');
const EXCHANGE_WS = require('./huobipro.ws.js');
const N = require('precise-number');
const R = require('ramda');

class EXCHANGE {
	constructor(options) {
		if (!options.Currency) options.Currency = 'BTC';
		if (!options.BaseCurrency) options.BaseCurrency = 'USDT';
		if (!options.Decimals) options.Decimals = 2;
		if (!options.MinTradeStocks) options.MinTradeStocks = 0.001;
		if (options.StockDecimals === undefined) options.StockDecimals = 4;

		options.domain = options.hadax ? 'api.hadax.com' : 'api.huobipro.com';

		this.options = options;

		this.isWS = options.isWS;
		if (this.isWS) {
			this.ws = new EXCHANGE_WS(options);
		}
		this.rest = new EXCHANGE_REST(options);
		this.fee = {
			BuyMaker: 0.2,
			SellMaker: 0.2,
			BuyTaker: 0.2,
			SellTaker: 0.2
		};
	}

	waitUntilWSReady() {
		if (!this.ws) {
			return false;
		}
		return this.ws.waitUntilWSReady();
	}

	GetMin() {
		return this.options.MinTradeStocks;
	}

	GetFee() {
		return this.fee;
	}

	SetFee(fee) {
		this.fee = fee;
	}

	GetName() {
		return this.options.Name ? this.options.Name : 'HuobiPro';
	}

	GetOptions() {
		return this.options;
	}

	getHandler() {
		return this.isWS ? this.ws : this.rest;
	}

	GetAccount(...args) {
		return this.rest.GetAccount(...args);
	}

	GetTicker() {
		return this.rest.GetTicker().then(t => {
			return {
				High: N.parse(t.high, this.options.Decimals),
				Low: N.parse(t.low, this.options.Decimals),
				Buy: N.parse(t.bid[0], this.options.Decimals),
				BuyAmount: N.parse(t.bid[1]),
				Sell: N.parse(t.ask[0], this.options.Decimals),
				SellAmount: N.parse(t.ask[1]),
				Last: N.parse((t.bid[0] + t.ask[0]) / 2, this.options.Decimals),
				Volume: N.parse(t.vol)
			};
		});
	}

	GetDepth(size) {
		return this.rest.GetDepth(size).then(tick => {
			tick.bids = tick.bids.map(b => {
				return {
					Price: N.parse(b[0]),
					Amount: N.parse(b[1])
				};
			});

			tick.asks = tick.asks.map(a => {
				return {
					Price: N.parse(a[0]),
					Amount: N.parse(a[1])
				};
			});

			return Promise.resolve({
				Asks: R.sort( R.descend( R.prop('Price') ), tick.asks),
				Bids: R.sort( R.descend( R.prop('Price') ), tick.bids)
			});
		});
	}

	GetRecords(minutes) {
		return this.rest.GetRecords(minutes).then(data => {
			let klines = [];
			data.map( d => {
				if (d && d[0] && d[1] && d[4]) {
					let seconds = this._parse_time(d[0]);
					klines.push({
						Time: seconds,
						Open: N.parse(d[1], this.options.Decimals),
						High: N.parse(d[2], this.options.Decimals),
						Low: N.parse(d[3], this.options.Decimals),
						Close: N.parse(d[4], this.options.Decimals),
						Volume: N.parse(d[5])
					});
				}
			});
			return klines;
		});
	}

	GetOrder(orderId) {
		return this.rest.GetOrder(orderId).then(data => {
			if (data && data.id) {
				return this._transform_order(data);
			} else {
				throw new Error('Order not found ' + orderId + ' ' + JSON.stringify(data));
			}
		});
	}

	_transform_order(data) {

		/*
		pre-submitted 准备提交, submitting , submitted 已提交, partial-filled 部分成交, partial-canceled 部分成交撤销, filled 完全成交, canceled 已撤销
		 */

		const STATUS = {
			'pre-submitted': 'Pending',
			'submitting': 'Pending',
			'submitted': 'Pending',
			'partial-filled': 'Partial',
			'partial-canceled': 'Cancelled',
			'filled': 'Closed',
			'canceled': 'Cancelled'
		};

		const TYPES = {
			'buy-market': 'Buy',
			'sell-market': 'Sell',
			'buy-limit': 'Buy',
			'sell-limit': 'Sell'
		};

		return {
			Id: data.id,
			Price: N.parse(data.price),
			Amount: N.parse(data.amount),
			DealAmount: N.parse(data['field-amount']),
			Status: STATUS[data.state] || 'Unknown',
			Type: TYPES[data.type] || 'Unknown',
			Fee: N.parse(data['field-fees']),
			Time: N.parse(data['created-at'])
		};
	}

	Buy(price, amount) {
		amount = N(amount).floor(this.options.StockDecimals) * 1;
		price = N(price).round(this.options.Decimals) * 1;
		if (amount < this.GetMin()) throw new Error(this.GetName() + ' buy amount should not less than ' + this.GetMin());
		return this.rest.Buy(price, amount);
	}

	Sell(price, amount) {
		amount = N(amount).floor(this.options.StockDecimals) * 1;
		price = N(price).round(this.options.Decimals) * 1;
		if (amount < this.GetMin()) throw new Error(this.GetName() + ' sell amount should not less than ' + this.GetMin());
		return this.rest.Sell(price, amount);
	}

	CancelOrder(orderId) {
		return this.rest.CancelOrder(orderId);
	}

	CancelPendingOrders() {
		return this.GetOrders().then(async orders => {
			let ids = orders.map(o => o.Id);
            console.log('cancelling', ids);
			while (ids && ids.length > 0) {
				let _ids = ids.splice(0, 50);
				await this.rest.CancelOrders(_ids);
			}
			return true;
		});
	}

	GetOrders() {
		return this.rest.GetOrders().then(data => {
			let orders = [];
			if (data && data.length > 0) {
				data.map(o => {
					orders.push(this._transform_order(o));
				});
			}
			orders = orders.filter(o => (o.Status !== 'Cancelled' && o.Status !== 'Closed'));
			return Promise.resolve(orders);
		});
	}

	_parse_time(t) {
		t = t.toString();
		let ms = t.match(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})/);
		let d = new Date();
		d.setTime(0);
		d.setFullYear( parseInt(ms[1], 10) );
		d.setMonth( parseInt(ms[2], 10) - 1 );
		d.setDate( parseInt( ms[3], 10) );
		d.setHours( parseInt(ms[4], 10) );
		d.setMinutes( parseInt(ms[5], 10) );
		t = d.getTime();
		t = Math.floor(t / 1000);
		return t;
	}

}


module.exports = EXCHANGE;
