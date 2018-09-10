const EXCHANGE_REST = require('./rest.js');
const EXCHANGE_WS = require('./ws.js');
const N = require('precise-number');
const { ok } = require('assert');
const fetch = require('node-fetch');
const EXCHANGE = require('../exchange.js');

class OKEX_FUTURE extends EXCHANGE {
	constructor(options) {
		options = Object.assign({
			Name: 'OKEX_FUTURE',
			Fees: {
				Maker: 0.0001,
				Taker: 0.0003
			},
			RateLimit: 10,
			Decimals: 8,
			StockDecimals: 3,
			MinTradeStocks: 1,
			BaseCurrency: 'USD',
			DefaultContactType: 'quarter',
			Currency: 'BTC',
			ContractMode: 'Seperate',
			MarginLevel: 10
		}, options);
		super(options);

		if (['All', 'Seperate'].indexOf(options.ContractMode) === -1) throw new Error('options.ContractMode should either be All or Seperate');
		if (options.MarginLevel !== 10 && options.MarginLevel !== 20) throw new Error('wrong MarginLevel');

		this._check_contract_type(options.DefaultContactType);

		if (this.options.BaseCurrency !== 'USD') throw new Error('okex future BaseCurrency should be USD');

		this.options = options;
		if (options.isWS) {
			this.ws = new EXCHANGE_WS(options);
			this.ws.on('connect', () => {
				this.wsReady = true;
			});
			this.ws.on('close', () => {
				this.wsReady = false;
			});
		}
		this.rest = new EXCHANGE_REST(options);
	}

	_check_contract_type(contract_type) {
		if (['this_week', 'next_week', 'quarter'].indexOf(contract_type) === -1) {
			throw new Error('unkown contract_type: ' + contract_type);
		}
	}

	_on_trade(cb) {
		return (err, o) => {
			if (err) {
				cb(err, o);
				return;
			}
			cb(false, {
				Id: o.orderId,
				Price: N.parse(o.tradePrice),
				AvgPrice: N.parse(o.averagePrice),
				Amount: N.parse(o.tradeAmount),
				DealAmount: N.parse(o.completedTradeAmount),
				Status: this._order_status(o.status),
				Type: this._order_type(o.tradeType),
				LeftAmount: N.parse(o.unTrade),
				UnitPrice: N.parse(o.tradeUnitPrice),
				SigAmount: N.parse(o.sigTradeAmount),
				SigPrice: N.parse(o.sigTradePrice),
				Time: N.parse(o.createdDate)
			});
		};
	}

	_on_account_change(cb) {
		return (err, data) => {
			if (err) {
				cb(err, data);
				return;
			}
			let currency = this.options.Currency.toLowerCase();
			cb(false, {
				Balance: N.parse(data.info.free.usd),
				FrozenBalance: N.parse(data.info.freezed.usd),
				Stocks: N.parse(data.info.free[currency]),
				FrozenStocks: N.parse(data.info.freezed[currency])
			});
		};
	}

	async Subscribe(currency, baseCurrency, type, contractType) {
		if (!this.options.isWS) throw new Error('is not websocket mode');
		if (['Depth', 'PublicTrades', 'Ticker'].indexOf(type) === -1) {
			throw new Error('unkown subscription type: ' + type);
		}

		if (contractType) this._check_contract_type(contractType);

		if (type === 'Depth' && !this.options.onDepth) throw new Error('no onDepth callback');
		if (type === 'Ticker' && !this.options.onTicker) throw new Error('no onTicker callback');
		if (type === 'PublicTrades' && !this.options.onPublicTrades) throw new Error('no onPublicTrades callback');

		try {
			await this.waitUntilWSReady();
			await this.ws.addSubscription(currency, baseCurrency, type, contractType);
		} catch (err) {
			console.error(this.GetName() + ` Subscribe got error:`, err);
			throw err;
		}
	}

	API(url, params, method) {
		if (!method) method = 'POST';
		return this.rest.fetch(url, params, method);
	}

	//设置杠杆倍率
	SetMarginLevel(level) {
		this.options.MarginLevel = level;
	}

	getHandler() {
		return this.rest;
	}

	GetAccount(...args) {
		return this.rest.GetAccount(...args);
	}

	GetPosition(contract_type) {
		return this.getHandler().GetPosition(contract_type).then(d => {
			/*
			{
			    "holding": [{
			        "buy_amount": 10,
			        "buy_available": 2,
			        "buy_bond": 1.27832803,
			        "buy_flatprice": "338.97",
			        "buy_price_avg": 555.67966869,
			        "buy_price_cost": 555.67966869,
			        "buy_profit_lossratio": "13.52",
			        "buy_profit_real": 0,
			        "contract_id": 20140815012,
			        "contract_type": "this_week",
			        "create_date": 1408594176000,
			        "sell_amount": 8,
			        "sell_available": 2,
			        "sell_bond": 0.24315591,
			        "sell_flatprice": "671.15",
			        "sell_price_avg": 567.04644056,
			        "sell_price_cost": 567.04644056,
			        "sell_profit_lossratio": "-45.04",
			        "sell_profit_real": 0,
			        "symbol": "btc_usd",
			        "lever_rate": 10
			    }],
			    "result": true
			}
			 */
			if (d && d.result && Array.isArray(d.holding)) {
				let re = [];
				d.holding.map(h => {
					if (h.buy_amount) {
						re.push({
							Info: h,
							MarginLevel: h.lever_rate,
							Amount: h.buy_amount,
							FrozenAmount: N(h.buy_amount).minus(h.buy_available) * 1,
							Price: N.parse(h.buy_price_avg),
							Profit: N.parse(h.buy_profit_real),
							Type: 'Long',
							ContractType: h.contract_type
						});
					}

					if (h.sell_amount) {
						re.push({
							Info: h,
							MarginLevel: h.lever_rate,
							Amount: h.sell_amount,
							FrozenAmount: N(h.sell_amount).minus(h.sell_available) * 1,
							Price: N.parse(h.sell_price_avg),
							Profit: N.parse(h.sell_profit_real),
							Type: 'Short',
							ContractType: h.contract_type
						});
					}
				});

				return re;
			}

			throw new Error('error position response: ' + JSON.stringify(d));
		});
	}

	GetTicker(...args) {
		return this.rest.GetTicker(...args);
	}

	GetOrder(orderId, contract_type) {
		return this.getHandler().GetOrder(orderId, contract_type).then(data => {
			let orders = [];
			/*
			{
				"symbol":"eos_usd",
				"lever_rate":10,
				"amount":1,
				"fee":0,
				"contract_name":"EOS0330",
				"unit_amount":10,
				"type":2,
				"price_avg":0,
				"deal_amount":0,
				"price":10,
				"create_date":1520957089000,
				"order_id":407705298549760,
				"status":0
			}
			 */
			if (data && data.orders && data.orders.length > 0) {
				orders = data.orders.map(o => this._transform_order(o));
			}

			if (orderId > 0) {
				if (orders.length > 0) {
					orders = orders[0];
				} else {
					let err = {
						error_code: 10009,
						error_message: '订单不存在',
						success: false,
						order_id: orderId
					};
					throw new Error(JSON.stringify(err));
				}
			}
			return Promise.resolve(orders);
		});
	}

	GetOrders(contract_type) {
		return this.GetOrder(-1, contract_type);
	}

	_transform_order(o) {
		return {
			Id: o.order_id,
			Price: N.parse(o.price),
			Amount: N.parse(o.amount),
			DealAmount: N.parse(o.deal_amount),
			Status: this._order_status(o.status),
			Type: this._order_type(o.type),
			AvgPrice: N.parse(o.avg_price),
			MarginLevel: N.parse(o.lever_rate),
			Symbol: o.symbol,
			Info: o
		};
	}

	Trade(direction, price, amount, contract_type) {
		if (!contract_type) contract_type = this.options.DefaultContactType;
		this._check_contract_type(contract_type);
		if (['Long', 'Short', 'CloseLong', 'CloseShort'].indexOf(direction) === -1) {
			throw new Error('unknown direction: ' + direction + ', direction should be one of these values: Long Short CloseLong CloseShort');
		}
		ok( amount > 0, 'amount should greater than 0');

		console.log(this.GetName(contract_type), direction, price, amount);
		return this.getHandler().Trade(direction, price, amount, contract_type).then( r => {
			if (r && r.result && r.order_id) {
				return r.order_id;
			} else {
				console.log(r);
				throw new Error(r);
			}
		});
	}

	CancelOrder(orderId, contract_type) {
		return this.getHandler().CancelOrder(orderId, contract_type).then(result => {
			if (result && (result.result === true || result.result === 'true')) return true;
			if (result && result.error_code === 1050) return true;
			if (result && result.error_code === 1009) return true;
			throw new Error('cancel order failed, result: ' + JSON.stringify(result));
		});
	}

	CancelPendingOrders(contract_type) {
		console.log('cancelling pending orders...');
		return this.GetOrders(contract_type).then( orders => {
			console.log('cancelling', orders.length, 'orders');
			return Promise.all(orders.map( o => {
				return this.CancelOrder(o.Id, contract_type);
			})).then( results => {
				console.log(results);
				return true;
			});
		});
	}

	GetDepth(...args) {
		return this.rest.GetDepth(...args);
	}

	async GetAvgPriceShift(contract_type) {
		let [k1, k2] = await Promise.all([
			this.GetIndexKline(),
			this.GetKline(contract_type)
		]);
		let k1hash = {}, k2hash = {};
		k1 = k1.map(k => {
			let m = Math.floor(k.Time / 60000);
			k1hash[m] = k.Close;
			k.m = m;
			return k;
		});
		k2 = k2.map(k => {
			let m = Math.floor(k.Time / 60000);
			k2hash[m] = k.Close;
			k.m = m;
			return k;
		});
		let startMinute = Math.max( Math.min.apply(null, k1.map(k => k.m)), Math.min.apply(null, k2.map(k => k.m)));
		let endMinute = Math.min( Math.max.apply(null, k1.map(k => k.m)), Math.max.apply(null, k2.map(k => k.m)));

		let totalDiff = 0, t = 0;
		for (let i = startMinute; i <= endMinute; i++) {
			if (k1hash[i] && k2hash[i]) {
				t ++;
				totalDiff += k1hash[i] - k2hash[i];
			}
		}
		if (t === 0) return 0;
		return totalDiff / t;
	}

	GetKline(contract_type, n) {
		if (!n) n = 100;
		if (!contract_type) contract_type = this.options.DefaultContactType;
		let url = `https://www.okex.com/v2/futures/pc/market/klineData.do?symbol=f_usd_${this.options.Currency.toLowerCase()}&type=1min&limit=${n}&coinVol=1&contractType=${contract_type}`;
		return fetch(url).then(res => res.json()).then(data => {
			if (data && data.data && data.data.length > 0) {
				return data.data.map(h => {
					let [Time, Open, High, Low, Close, Volume] = h;
					return {Open, High, Low, Close, Volume, Time};
				});
			}
		});
	}

	GetIndexKline(n) {
		if (!n) n = 100;
		let url = `https://www.okex.com/v2/market/index/kLine?symbol=f_usd_${this.options.Currency.toLowerCase()}&type=1min&limit=${n}&coinVol=0`;
		return fetch(url).then(res => res.json()).then(data => {
			if (data && data.data && data.data.length > 0) {
				return data.data.map(h => {
					let [Time, Open, High, Low, Close, Volume] = h;
					return {Open, High, Low, Close, Volume, Time};
				});
			}
		});
	}

	_order_status( status ) {
		//订单状态(0等待成交 1部分成交 2全部成交 -1撤单 4撤单处理中 5撤单中)
		status = status.toString();
		let arr = {
			'-1':'Cancelled',
			'0': 'Pending',
			'1': 'Partial',
			'2': 'Closed',
			'4': 'Pending',
			'5': 'Cancelled'
		};
		return arr[status + ''];
	}

	_order_type( type ) {
		//订单类型 1：开多 2：开空 3：平多 4： 平空
		type = type.toString();
		let arr = {
			'1': 'Long',
			'2': 'Short',
			'3': 'CloseLong',
			'4': 'CloseShort'
		};
		return arr[`${type}`];
	}

}


module.exports = OKEX_FUTURE;
