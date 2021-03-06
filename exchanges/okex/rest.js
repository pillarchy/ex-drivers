const { md5 }  = require('utility');
const fetch = require('node-fetch');
const N = require('precise-number');
const R = require('ramda');
const debug = require('debug')('exchange:okex:rest');
const RateLimit = require('../../lib/rate-limit');
const ExError = require('../../lib/error');
const ErrorCode = require('../../lib/error-code');
const agent = require('../../lib/agent');


class OKEX_REST {

	constructor(options) {
		this.symbol = options.Currency.toLowerCase() + '_' + options.BaseCurrency.toLowerCase();
		this.options = options;

		this.getAccountRateLimiter = new RateLimit(2000, 6);
		this.tradeRateLimiter = new RateLimit(2000, 20);
		this.cancelRateLimiter = new RateLimit(2000, 20);
		this.orderInfoRateLimiter = new RateLimit(2000, 20);
	}

	_getSymbol(Currency, BaseCurrency) {
		let c = Currency || this.options.Currency;
		let bc = BaseCurrency || this.options.BaseCurrency;
		return c.toLowerCase() + '_' + bc.toLowerCase();
	}

	_parse_ch(ch) {
		if (!ch) ch = '';
		let ms = ch.match(/^([0-9a-z]+)\_([0-9a-z]+)$/);
		if (ms && ms[1] && ms[2]) {
			return {
				Currency: String(ms[1]).toUpperCase(),
				BaseCurrency: String(ms[2]).toUpperCase()
			};
		} else {
			return {
				Currency: this.options.Currency,
				BaseCurrency: this.options.BaseCurrency
			};
		}
	}

	async fetch(url, params, method) {
		await this.options.rateLimiter.wait();
		if (!params) params = {};
		params.api_key = this.options.Key;
		params.sign = sign(params, this.options.Secret);

		let vars = [];
		for (let key in params) {
			vars.push(key + '=' + encodeURIComponent(params[key]));
		}
		let body = vars.join('&');

		debug('<<', method, url, 'BODY:', body);

		let httpMethod = method ? method : 'POST';
		
		let options = {
			method: httpMethod,
			timeout: httpMethod === 'GET' ? 2000 : 5000,
			headers: {},
			agent: agent.https
		};

		if (httpMethod === 'POST') {
			options.body = body;
			options.headers['Content-Length'] = body.length;
			options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
		}

		url = 'https://www.okex.com/api/v1/' + url;
		return fetch(url, options).then(async res => {
			let status = res.status;
			if (status === 429) throw new ExError(ErrorCode.REQUEST_TOO_FAST, url + ' too many requests');

			let raw = await res.text();
			debug('>>', method, url, 'RESPONSE:', raw);
			if (!raw) throw new Error('okex rest response text is empty');
			let json = null;
			try {
				json = JSON.parse(raw);
			} catch (err) {
				console.error('okex rest method returns bad json:', raw);
			}

			if (json && json.error_code) {
				json.error_message = errorMessage(json.error_code);
				let err = new Error(JSON.stringify(json));
				err.error_code = json.error_code;
				err.code = json.error_code;
				//if (json.error_code === 1002) err.need_sync = true;
				throw err;
			} else {
				return json;
			}
		}).catch(err => {
			if (err.type === 'request-timeout') {
				throw new ExError(ErrorCode.REQUEST_TIMEOUT, `rest request (${url}) timeout`, err);
			}
			throw err;
		});
	}

	async GetTicker(Currency, BaseCurrency) {
		let data = await this.fetch('ticker.do?symbol=' + this._getSymbol(Currency, BaseCurrency), null, 'GET');
		return {
			High: N.parse(data.ticker.high),
			Low: N.parse(data.ticker.low),
			Buy: N.parse(data.ticker.buy),
			Sell: N.parse(data.ticker.sell),
			Last: N.parse(data.ticker.last),
			Volume: N.parse(data.ticker.vol),
			Time: N.parse(data.date) * 1000,
			...this._parse_ch(this._getSymbol(Currency, BaseCurrency))
		};
	}

	async GetAccount() {
		await this.getAccountRateLimiter.wait();
		return this.fetch('userinfo.do');
	}

	/*
	if orderId === -1, it will return all unfinished orders
	 */
	async GetOrder(orderId, Currency, BaseCurrency) {
		await this.orderInfoRateLimiter.wait();
		return this.fetch('order_info.do', {
			symbol: this._getSymbol(Currency, BaseCurrency),
			order_id: orderId
		});
	}

	//get order history
	GetTrades(Currency, BaseCurrency, page = 1) {
		return this.fetch('order_history.do', {
			symbol: this._getSymbol(Currency, BaseCurrency),
			status: 1, //finished orders
			current_page: page,
			page_length: 200
		});
	}

	GetPublicTrades(Currency, BaseCurrency, since) {
		let extra = since ? '&since=' + since : '';
		return this.fetch('trades.do?symbol=' + this._getSymbol(Currency, BaseCurrency) + extra, null, 'GET');
	}

	async CancelOrder(orderId, Currency, BaseCurrency) {
		await this.cancelRateLimiter.wait();
		return this.fetch('cancel_order.do', {
			symbol: this._getSymbol(Currency, BaseCurrency),
			order_id: orderId
		}).catch(err => {
			if (err && err.error_code) return err;
			throw err;
		});
	}

	async Trade(type, price, amount, Currency, BaseCurrency) {
		if (await this.tradeRateLimiter.wait() > 100) {
			throw new ExError(ErrorCode.REQUEST_TOO_FAST, 'okex trade too fast');
		}

		type = String(type).toLowerCase();
		if (price === -1) type += '_market';
		let params = {
			symbol: this._getSymbol(Currency, BaseCurrency),
			type,
			price,
			amount
		};
		
		if (type === 'buy_market') {
			params.price = params.amount;
			delete(params.amount);
		}

		if (type === 'sell_market') {
			delete(params.price);
		}

		let re = await this.fetch('trade.do', params);
		return re;
	}

	async FundsTransfer(Currency,Amount,From,To){
		let params = {
			symbol: Currency.toLowerCase() + '_usd',
			amount: Amount,
			from: From,
			to: To
		};
		return await this.fetch('funds_transfer.do', params);
	}

	GetDepth(Currency, BaseCurrency, size, merge) {
		Currency = Currency || this.options.Currency;
		BaseCurrency = BaseCurrency || this.options.BaseCurrency;

		let params = ['symbol=' + this._getSymbol(Currency, BaseCurrency)];
		if (!size) size = 50;
		if (size) params.push('size=' + size);
		if (merge) params.push('merge=' + merge);

		return this.fetch('depth.do?' + params.join('&'), null, 'GET').then(data => {

			if (!data || !data.bids || !data.asks) throw new Error('get okcoin ' + this.symbol + ' depth error ' + JSON.stringify(data));
console.log(data);
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

			return Promise.resolve({
				Asks: R.sort( R.ascend( R.prop('Price') ), asks),
				Bids: R.sort( R.descend( R.prop('Price') ), bids),
				Currency,
				BaseCurrency,
				...this._parse_ch(this._getSymbol(Currency, BaseCurrency))
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
		if (i !== 0) {
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
		503:   '用户请求过于频繁(Http)',
		20001: 'user does not exist',
		20002: 'user frozen',
		20003: 'frozen due to force liquidation',
		20004: 'future account frozen',
		20005: 'user future account does not exist',
		20006: 'required field can not be null',
		20007: 'illegal parameter',
		20008: 'future account fund balance is zero',
		20009: 'future contract status error',
		20010: 'risk rate information does not exist',
		20011: 'risk rate bigger than 90% before opening position',
		20012: 'risk rate bigger than 90% after opening position',
		20013: 'temporally no counter party price',
		20014: 'system error',
		20015: 'order does not exist',
		20016: 'liquidation quantity bigger than holding',
		20017: 'not authorized/illegal order ID',
		20018: 'order price higher than 105% or lower than 95% of the price of last minute',
		20019: 'IP restrained to access the resource',
		20020: 'secret key does not exist',
		20021: 'index information does not exist',
		20022: 'wrong API interface',
		20023: 'fixed margin user',
		20024: 'signature does not match',
		20025: 'leverage rate error',
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
		return 'OKEX error code: ' + code + 'is not supported';
	}

	return codes[code];
}

module.exports = OKEX_REST;
