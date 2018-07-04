const REST = require('./rest.js');
const WS = require('./ws.js');
const N = require('precise-number');
const R = require('ramda');
const EXCHANGE = require('../exchange.js');

class HUOBI extends EXCHANGE {
	constructor(options) {
		options = Object.assign({
			Name: 'Huobi',
			Fees: {
				Maker: 0.002,
				Taker: 0.002
			},
			RateLimit: 10,
			MinTradeStocks: 0.001,
			DefaultDepthStep: 'step0'
		}, options);
		options.domain = options.hadax ? 'api.hadax.com' : 'api.huobipro.com';
		super(options);

		if (this.options.isWS) {
			this.ws = new WS(this.options);
			this.ws.on('connect', () => {
				this.wsReady = true;
			});
			this.ws.on('close', () => {
				this.wsReady = false;
			});
		}

		this.rest = new REST(this.options);
	}

	getHandler() {
		return this.options.isWS ? this.ws : this.rest;
	}

	GetAccount(...args) {
		return this.rest.GetAccount(...args);
	}

	GetAccounts(...args) {
		return this.rest.GetAccounts(...args);
	}

	async Subscribe(currency, baseCurrency, type) {
		if (!this.options.isWS) throw new Error('is not websocket mode');
		if (['Depth', 'PublicTrades', 'Ticker'].indexOf(type) === -1) {
			throw new Error('unkown subscription type: ' + type);
		}

		if (type === 'Depth' && !this.options.onDepth) throw new Error('no onDepth callback');
		if (type === 'Ticker' && !this.options.onTicker) throw new Error('no onTicker callback');
		if (type === 'PublicTrades' && !this.options.onPublicTrades) throw new Error('no onPublicTrades callback');

		try {
			await this.waitUntilWSReady();
			await this.ws.addSubscription(currency, baseCurrency, type);
		} catch (err) {
			console.error(this.GetName() + ` Subscribe got error:`, err);
			throw err;
		}
	}

	GetTicker(...args) {
		return this.rest.GetTicker(...args);
	}

	GetDepth(...args) {
		return this.rest.GetDepth(...args);
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

	GetOrder(orderId, Currency, BaseCurrency) {
		return this.rest.GetOrder(orderId, Currency, BaseCurrency).then(data => {
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
			AvgPrice: N.parse(data.price),
			Amount: N.parse(data.amount),
			DealAmount: N.parse(data['field-amount']),
			Status: STATUS[data.state] || 'Unknown',
			Type: TYPES[data.type] || 'Unknown',
			Fee: N.parse(data['field-fees']),
			Time: N.parse(data['created-at']),
			...this.rest._parse_ch(data.symbol),
			Info: data
		};
	}

	Buy(...args) {
		return this.Trade('Buy', ...args);	
	}

	Sell(...args) {
		return this.Trade('Sell', ...args);	
	}

	Trade(type, price, amount, Currency, BaseCurrency) {
		if (type !== 'Buy' && type !== 'Sell') throw new Error('wrong trade type: ' + type);
		if (this.options.StockDecimals) amount = N(amount).floor(this.options.StockDecimals);
		if (this.options.Decimals) price = N(price).round(this.options.Decimals);
		if (amount <= 0) throw new Error('trade amount should greater than 0');
		return this.rest.Trade(type, price, amount, Currency, BaseCurrency);
	}

	CancelOrder(orderId, Currency, BaseCurrency) {
		return this.rest.CancelOrder(orderId, Currency, BaseCurrency);
	}

	CancelPendingOrders(Currency, BaseCurrency) {
		return this.GetOrders(Currency, BaseCurrency).then(async orders => {
			let ids = orders.map(o => o.Id);
			console.log('cancelling', ids);
			while (ids && ids.length > 0) {
				let _ids = ids.splice(0, 50);
				await this.rest.CancelOrders(_ids, Currency, BaseCurrency);
			}
			return true;
		});
	}

	GetOrders(Currency, BaseCurrency) {
		return this.rest.GetOrders(Currency, BaseCurrency).then(orders => {
			return orders.map(this._transform_order.bind(this)).filter(o => (o.Status !== 'Cancelled' && o.Status !== 'Closed'));
		});
	}

	GetTrades(Currency, BaseCurrency) {
		return this.rest.GetTrades(Currency, BaseCurrency).then(orders => {
			return orders.map(this._transform_order.bind(this)).filter(o => (o.Status === 'Cancelled' || o.Status === 'Closed') && o.DealAmount > 0);
		}).then(trades => {
			return R.sort( R.ascend( R.prop('Time') ), trades);
		});
	}

	async GetPublicTrades(Currency, BaseCurrency, size = 600) {
		let data = await this.rest.GetPublicTrades(Currency, BaseCurrency, size);
		let trades = [], info = this.rest._parse_ch(this.rest._getSymbol(Currency, BaseCurrency));
		if (data && data.length > 0) {
			data.reverse();
			data.map(o => {
				let { id, ts, data: arr } = o;
				if (arr && arr.length > 0) {
					arr.map(o => {
						trades.push({
							Id: id,
							Time: N.parse(ts),
							Price: N.parse(o.price),
							Amount: N.parse(o.amount),
							Type: o.direction === 'sell' ? 'Sell' : 'Buy',
							...info
						});
					});
				}
			});
		};
		return trades;
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


module.exports = HUOBI;
