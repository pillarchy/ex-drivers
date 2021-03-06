const { md5 }  = require('utility');
const fetch = require('node-fetch');
const N = require('precise-number');
const R = require('ramda');
const debug = require('debug')('exchange:okex:rest');
const agent = require('../../lib/agent');

class OKEX {

	constructor(options) {
		this.key = options.Key;
		this.secret = options.Secret;
		this.symbol = options.Currency.toLowerCase() + '_' + options.BaseCurrency.toLowerCase();
		this.options = options;
		if (!this.options.rateLimiter) throw 'No rateLimiter in options';
	}

	async fetch(url, params, method) {
		await this.options.rateLimiter.wait();
		let body = '';
		if (!method) method = 'POST';
		if (method === 'POST') {
			if (!params) params = {};
			params.api_key = this.key;
			params.sign = sign(params, this.secret);

			let vars = [];
			for (let key in params) {
				vars.push(key + '=' + encodeURIComponent(params[key]));
			}
			body = vars.join('&');
		}

		debug('<<', method, 'https://www.okex.com/api/v1/' + url, 'BODY:', body);

		let httpMethod = method ? method : 'POST';
		let options = {
			method: httpMethod,
			timeout: httpMethod === 'GET' ? 4000 : 4000,
			headers: {
				'Content-Type':'application/x-www-form-urlencoded',
				'Content-Length': body.length
			},
			agent: agent.https
		};

		if (body) options.body = body;

		return fetch('https://www.okex.com/api/v1/' + url, options).then(res => res.text()).then(t => {
			debug('>> ' + t);

			if (!t) return Promise.reject('OKEX returns empty: ' + url);
			try {
				let d = JSON.parse(t);
				return Promise.resolve(d);
			} catch ( err ) {
				return Promise.reject('OKEX JSON parse error: ' + t);
			}
		}).then(json => {
			if (json && json.error_code) {
				json.error_message = errorMessage(json.error_code);
				let err = new Error(JSON.stringify(json));
				err.error_code = json.error_code;
				throw err;
			} else {
				return Promise.resolve(json);
			}
		}).catch(err => {
			if (err && err.type === 'request-timeout') {
				throw url + ' timeout';
			}
			throw err;
		});
	}

	_getSymbol(Currency, BaseCurrency) {
		if (!Currency) Currency = this.options.Currency;
		if (!BaseCurrency) BaseCurrency = this.options.BaseCurrency;
		return Currency.toLowerCase() + '_' + BaseCurrency.toLowerCase();
	}

	_parseSymbol(Currency, BaseCurrency, ContractType) {
		if (!Currency) Currency = this.options.Currency;
		if (!BaseCurrency) BaseCurrency = this.options.BaseCurrency;
		if (!ContractType) ContractType = this.options.DefaultContactType;
		return { Currency, BaseCurrency, ContractType };
	}

	GetTicker(Currency, BaseCurrency, contract_type) {
		return this.fetch(`future_ticker.do?symbol=${this._getSymbol(Currency, BaseCurrency)}&contract_type=${contract_type || this.options.DefaultContactType}`, null, 'GET').then(data => {
			return Promise.resolve({
				High: N.parse(data.ticker.high),
				Low: N.parse(data.ticker.low),
				Buy: N.parse(data.ticker.buy),
				Sell: N.parse(data.ticker.sell),
				Last: N.parse(data.ticker.last),
				Volume: N.parse(data.ticker.vol),
				Time: N.parse(data.date) * 1000,
				ContractId: data.ticker.contract_id + '',
				UnitAmount: N.parse(data.ticker.unit_amount),
				...this._parseSymbol(Currency, BaseCurrency, contract_type)
			});
		});
	}

	GetAccount(Currency, BaseCurrency) {
		if (!Currency) Currency = this.options.Currency;
		if (!BaseCurrency) BaseCurrency = this.options.BaseCurrency;
		let path = this.options.ContractMode === 'Seperate' ? 'future_userinfo_4fix.do' : 'future_userinfo.do';
		return this.fetch(path).then(data => {
			let currency = Currency.toLowerCase();
			let info = data.info[currency];
			let re = {
				Balance: 0,
				FrozenBalance: 0,
				Stocks: N.parse(info.account_rights),
				FrozenStocks: N.parse(info.keep_deposit),
				Value: 0,
				this_week: null,
				next_week: null,
				quarter: null,
				Currency,
				BaseCurrency,
				Info: data.info
			};

			if (info.contracts) {
				info.contracts.map(c => {
					re.FrozenStocks = N(re.FrozenStocks).add(c.bond) * 1;
					re[c.contract_type] = c;
				});
			}
			return re;
		});
	}

	GetPosition(contract_type) {
		let path = this.options.ContractMode === 'Seperate' ? 'future_position_4fix.do' : 'future_position.do';
		return this.fetch(path, {
			symbol: this.symbol,
			contract_type: contract_type || this.options.DefaultContactType
		}, 'POST');
	}

	GetOrder(orderId, contract_type) {
		let params = {
			symbol: this.symbol,
			contract_type: contract_type || this.options.DefaultContactType,
			order_id: orderId,
			page_length: 50,
			current_page: 1
		};
		if (orderId === -1 || orderId === '-1') {
			params.status = 1;
		}
		return this.fetch('future_order_info.do', params);
	}

	CancelOrder(orderId, contract_type) {
		return this.fetch('future_cancel.do', {
			symbol: this.symbol,
			order_id: orderId,
			contract_type: contract_type || this.options.DefaultContactType,
		}).catch(err => {
			if (err && err.error_code === 20015) return { result: true };
			throw err;
		});
	}

	Trade(direction, price, amount, contract_type) {
		let params = {
			symbol: this.symbol,
			contract_type,
			type: (['Long', 'Short', 'CloseLong', 'CloseShort'].indexOf(direction) + 1) + '',
			price,
			amount,
			match_price: price === -1 ? '1' : '0',
			lever_rate: this.options.MarginLevel
		};
		if (price === -1) {
			delete(params.price);
		}

		return this.fetch('future_trade.do', params);
	}

	GetDepth(Currency, BaseCurrency, ContractType, size, merge) {
		let params = ['symbol=' + this._getSymbol(Currency, BaseCurrency)];
		if (!size) size = 30;
		if (size) params.push('size=' + size);
		if (merge) params.push('merge=' + merge);
		params.push('contract_type=' + (ContractType || this.options.DefaultContactType));

		return this.fetch('future_depth.do?' + params.join('&'), null, 'GET').then(data => {

			if (!data || !data.bids || !data.asks) throw new Error('get okcoin ' + this.symbol + ' depth error ' + JSON.stringify(data));

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

			bids.sort((a, b) => {
				let diff = a.Price - b.Price;
				return diff > 0 ? -1 : diff == 0 ? 0 : 1;
			});

			asks.sort((a, b) => {
				let diff = a.Price - b.Price;
				return diff > 0 ? 1 : diff == 0 ? 0 : -1;
			});

			return Promise.resolve({
				Asks: R.sort( R.ascend( R.prop('Price') ), asks),
				Bids: R.sort( R.descend( R.prop('Price') ), bids),
				...this._parseSymbol(Currency, BaseCurrency, ContractType)
			});
		});
	}
}

function sign(params, secret) {
	return md5(stringifyForSign(params) + '&secret_key=' + secret).toUpperCase();
}

function stringifyForSign(obj) {
	let arr = [],
		i,
		formattedObject = '';

	for (i in obj) {
		if (obj.hasOwnProperty(i)) {
			arr.push(i);
		}
	}
	arr.sort();
	for (i = 0; i < arr.length; i++) {
		if (i != 0) {
			formattedObject += '&';
		}
		formattedObject += arr[i] + '=' + obj[arr[i]];
	}
	return formattedObject;
}

function errorMessage(code) {
	let codes = {
		10000: '必选参数不能为空',
		10001: '用户请求过于频繁',
		10002: '系统错误',
		10003: '未在请求限制列表中,稍后请重试',
		10004: 'IP限制不能请求该资源',
		10005: '密钥不存在',
		10006: '用户不存在',
		10007: '签名不匹配',
		10008: '非法参数',
		10009: '订单不存在',
		10010: '余额不足',
		10011: '买卖的数量小于BTC/LTC最小买卖额度',
		10012: '当前网站暂时只支持btc_cny ltc_cny',
		10013: '此接口只支持https请求',
		10014: '下单价格不得≤0或≥1000000',
		10015: '下单价格与最新成交价偏差过大',
		10016: '币数量不足',
		10017: 'API鉴权失败',
		10018: '借入不能小于最低限额[cny:100,btc:0.1,ltc:1]',
		10019: '页面没有同意借贷协议',
		10020: '费率不能大于1%',
		10021: '费率不能小于0.01%',
		10023: '获取最新成交价错误',
		10024: '可借金额不足',
		10025: '额度已满，暂时无法借款',
		10026: '借款(含预约借款)及保证金部分不能提出',
		10027: '修改敏感提币验证信息，24小时内不允许提现',
		10028: '提币金额已超过今日提币限额',
		10029: '账户有借款，请撤消借款或者还清借款后提币',
		10031: '存在BTC/LTC充值，该部分等值金额需6个网络确认后方能提出',
		10032: '未绑定手机或谷歌验证',
		10033: '服务费大于最大网络手续费',
		10034: '服务费小于最低网络手续费',
		10035: '可用BTC/LTC不足',
		10036: '提币数量小于最小提币数量',
		10037: '交易密码未设置',
		10040: '取消提币失败',
		10041: '提币地址不存在或者未认证',
		10042: '交易密码错误',
		10043: '合约权益错误，提币失败',
		10044: '取消借款失败',
		10047: '当前为子账户，此功能未开放',
		10048: '提币信息不存在',
		10049: '小额委托（<0.15BTC)的未成交委托数量不得大于50个',
		10050: '重复撤单',
		10100: '账户被冻结',
		10101: '订单类型错误',
		10102: '不是本用户的订单',
		10103: '私密订单密钥错误',
		10216: '非开放API',
		20001: '用户不存在',
		20002: '用户被冻结',
		20003: '用户被爆仓冻结',
		20004: '合约账户被冻结',
		20005: '用户合约账户不存在',
		20006: '必填参数为空',
		20007: '参数错误',
		20008: '合约账户余额为空',
		20009: '虚拟合约状态错误',
		20010: '合约风险率信息不存在',
		20011: '10倍/20倍杠杆开BTC前保证金率低于90%/80%，10倍/20倍杠杆开LTC前保证金率低于80%/60%',
		20012: '10倍/20倍杠杆开BTC后保证金率低于90%/80%，10倍/20倍杠杆开LTC后保证金率低于80%/60%',
		20013: '暂无对手价',
		20014: '系统错误',
		20015: '订单信息不存在',
		20016: '平仓数量是否大于同方向可用持仓数量',
		20017: '非本人操作',
		20018: '下单价格高于前一分钟的103%或低于97%',
		20019: '该IP限制不能请求该资源',
		20020: '密钥不存在',
		20021: '指数信息不存在',
		20022: '接口调用错误（全仓模式调用全仓接口，逐仓模式调用逐仓接口）',
		20023: '逐仓用户',
		20024: 'sign签名不匹配',
		20025: '杠杆比率错误',
		20026: 'API鉴权错误',
		20027: '无交易记录',
		20028: '合约不存在',
		20029: '转出金额大于可转金额',
		20030: '账户存在借款',
		20038: '根据相关法律，您所在的国家或地区不能使用该功能。',
		20049: '用户请求接口过于频繁',
		20061: '合约相同方向只支持一个杠杆，若有10倍多单，就不能再下20倍多单',
		1002:	'交易金额大于余额',
		1003: 	'交易金额小于最小交易值',
		1004:	'交易金额小于0',
		1007:	'没有交易市场信息',
		1008:	'没有最新行情信息',
		1009:	'没有订单',
		1010:	'撤销订单与原订单用户不一致',
		1011:	'没有查询到该用户',
		1013:	'没有订单类型',
		1014:	'没有登录',
		1015:	'没有获取到行情深度信息',
		1017:	'日期参数错误',
		1018:	'下单失败',
		1019:	'撤销订单失败',
		1024:	'币种不存在',
		1025:	'没有K线类型',
		1026:	'没有基准币数量',
		1027:	'参数不合法可能超出限制',
		1028:	'保留小数位失败',
		1029:	'正在准备中',
		1030:	'有融资融币无法进行交易',
		1031:	'转账余额不足',
		1032:	'该币种不能转账',
		1035:	'密码不合法',
		1036:	'谷歌验证码不合法',
		1037:	'谷歌验证码不正确',
		1038:	'谷歌验证码重复使用',
		1039:	'短信验证码输错限制',
		1040:	'短信验证码不合法',
		1041:	'短信验证码不正确',
		1042:	'谷歌验证码输错限制',
		1043:	'登陆密码不允许与交易密码一致',
		1044:	'原密码错误',
		1045:	'未设置二次验证',
		1046:	'原密码未输入',
		1048:	'用户被冻结',
		1201:	'账号零时删除',
		1202:	'账号不存在',
		1203:	'转账金额大于余额',
		1204:	'不同种币种不能转账',
		1205:	'账号不存在主从关系',
		1206:	'提现用户被冻结',
		1207:	'不支持转账',
		1208:	'没有该转账用户',
		1209:	'当前api不可用'
	};
	if (!codes[code]) {
		return 'OKex error code: ' + code + 'is not supported';
	}

	return codes[code];
}

module.exports = OKEX;
