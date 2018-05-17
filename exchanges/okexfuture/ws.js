const OKWS = require('./okex.ws.js');
const Queue = require('../../lib/queue.js');
const N = require('precise-number');
const R = require('ramda');
const wait = require('delay');
const debug = require('debug')('okex:ws');

class EXCHANGE {

	constructor(options) {

		this.accountInfoQueue = new Queue(10000);
		this.tradeQueue = new Queue(3000);
		this.orderInfoQueue = new Queue(3000);
		this.cancelOrderQueue = new Queue(3000);

		this.options = options;

		if (!options.Currency) throw new Error('no Currency');
		this.symbol = options.Currency.toLowerCase() + '_' + options.BaseCurrency.toLowerCase();
		this.options.Symbol = this.symbol;
		this.options.onConnect = () => {
			debug('onConnect');
			this.wsReady = true;
		};

		this.ws = new OKWS(this.options);

		this.ws.onConnect = options.onConnect;

		this.wsReady = false;

		let handlers = {};

		if (this.options.onDepth) {
			handlers[`ok_sub_futureusd_${this.options.Currency.toLowerCase()}_depth_${this.options.DefaultContactType.toLowerCase()}_20`] = (data, err) => {
				this.onDepth(data, err);
			};
		}

		if (this.options.onIndex) {
			handlers[`ok_sub_futureusd_${this.options.Currency.toLowerCase()}_index`] = (data, err) => {
				this.onIndex(data, err);
			}
		}

		if (options.onAccountChange) {
			handlers['ok_sub_futureusd_userinfo'] = (data, err) => {
				this.onAccountChange(data, err);
			};
		}

		if (options.onTicker) {
			handlers[`ok_sub_futureusd_${this.options.Currency.toLowerCase()}_ticker_${this.options.DefaultContactType.toLowerCase()}`] = (data, err) => {
				this.onTicker(data, err);
			}
		}

		if (options.onPositionChange) {
			handlers['ok_sub_futureusd_positions'] = (data, err) => {
				this.onPositionChange(data, err);
			};
		}

		if (options.onTrade) {
			handlers['ok_sub_futureusd_trades'] = (data, err) => {
				this.onTrade(data, err);
			};
		}

		this.ws.subscribe(handlers);

		this.cb = options.onUpadte ? options.onUpadte : function() { };
	}

	onTicker(data, err) {
		/*
		{ high: '7069',
		  limitLow: '6861.11',
		  vol: '10612960',
		  last: '7042.32',
		  low: '6329.66',
		  buy: '7041.63',
		  hold_amount: '1001328',
		  sell: '7043.82',
		  contractId: 201806290000034,
		  unitAmount: '100',
		  limitHigh: '7286.02' }
		 */
		let re = {
			Open: N.parse(data.last),
			High: N.parse(data.high),
			Low: N.parse(data.low),
			Close: N.parse(data.last),
			Buy: N.parse(data.buy),
			Sell: N.parse(data.sell),
			LimitHigh: N.parse(data.limitHigh),
			LimitLow: N.parse(data.limitLow),
			Volume: N.parse(data.vol)
		};
		if (this.options.onTicker) {
			this.options.onTicker(re);
		}
	}

	onAccountChange(data) {
		/*
		全仓信息
		balance(double): 账户余额
		symbol(string)：币种
		keep_deposit(double)：保证金
		profit_real(double)：已实现盈亏
		unit_amount(int)：合约价值
		逐仓信息
		balance(double):账户余额
		available(double):合约可用
		balance(double):合约余额
		bond(double):固定保证金
		contract_id(long):合约ID
		contract_type(string):合约类别
		freeze(double):冻结
		profit(double):已实现盈亏
		unprofit(double):未实现盈亏
		rights(double):账户权益
		 */
		if (typeof this.options.onAccountChange === 'function' && data) {
			let re = {
				Balance: N.parse(data.balance),
				Info: data
			};

			data.contracts.map(c => {
				re.Balance = N(re.Balance).add(c.balance) * 1;
			});

			this.options.onAccountChange(re);
		}
	}

	onPositionChange(data) {
		if (data && typeof this.options.onPositionChange === 'function') {
			/*
			全仓说明
			position(string): 仓位 1多仓 2空仓
			contract_name(string): 合约名称
			costprice(string): 开仓价格
			bondfreez(string): 当前合约冻结保证金
			avgprice(string): 开仓均价
			contract_id(long): 合约id
			position_id(long): 仓位id
			hold_amount(string): 持仓量
			eveningup(string): 可平仓量
			margin(double): 固定保证金
			realized(double):已实现盈亏

			逐仓说明
			contract_id(long): 合约id
			contract_name(string): 合约名称
			avgprice(string): 开仓均价
			balance(string): 合约账户余额
			bondfreez(string): 当前合约冻结保证金
			costprice(string): 开仓价格
			eveningup(string): 可平仓量
			forcedprice(string): 强平价格
			position(string): 仓位 1多仓 2空仓
			profitreal(string): 已实现盈亏
			fixmargin(double): 固定保证金
			hold_amount(string): 持仓量
			lever_rate(double): 杠杆倍数
			position_id(long): 仓位id
			symbol(string): btc_usd   ltc_usd   eth_usd   etc_usd   bch_usd
			user_id(long):用户ID
			 */
			let re = [];
			data.positions.map(h => {
				if (h && h.eveningup > 0) {	
					re.push({
						Info: h,
						MarginLevel: h.lever_rate,
						Amount: h.eveningup,
						FrozenAmount: N.parse(h.bondfreez),
						Price: N.parse(h.avgprice),
						Profit: N.parse(h.profitreal),
						Type: h.position * 1 === 1 ? 'Long' : 'Short',
						ContractType: this.options.DefaultContactType
					});
				}
			});
			this.options.onPositionChange(re);
		}
	}

	onTrade(data, err) {
		if (typeof this.options.onTrade === 'function' && !err) {
			this.options.onTrade(data);
		}
	}

	onIndex(data, err) {
		if (typeof this.options.onIndex === 'function' && !err) {
			this.options.onIndex(data.futureIndex);
		}
	}

	async waitUntilWSReady() {
		while (!this.wsReady) {
			console.log('okex ws not ready');
			await wait(300);
		}
	}

	async GetAccount() {
		await this.waitUntilWSReady();
		return this.accountInfoQueue.push(() => {
			this.ws.accountInfo();
		});
	}

	onDepth(data, err) {
		if (!err && data && data.bids && data.asks) {

			let asks = [];
			let bids = [];

			for (let i = 0;i < data.bids.length;i++) {
				bids.push({
					Price: data.bids[i][0] * 1,
					Amount: data.bids[i][1] * 1
				});
			}

			for (let i = 0;i < data.asks.length;i++) {
				asks.push({
					Price: data.asks[i][0] * 1,
					Amount: data.asks[i][1] * 1
				});
			}

			data = {
				Asks: R.sort( R.descend( R.prop('Price') ), asks),
				Bids: R.sort( R.descend( R.prop('Price') ), bids)
			};
		} else {
			err = true;
		}
		if (typeof this.options.onDepth === 'function') {
			if (!err) {
				this.options.onDepth(data);
			}
		}
	}

}


module.exports = EXCHANGE;
