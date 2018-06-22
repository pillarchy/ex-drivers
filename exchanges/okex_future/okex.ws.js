const { md5 }  = require('utility');
const WS = require('../../lib/auto-reconnect-ws.js');
const debug = require('debug')('okex:ws2');
const clor = require('clor');

class okex {

	constructor(options) {
		this.options = options;
		this.key = options.Key;
		this.secret = options.Secret;
		this.symbol = options.Symbol;
		this.connected = false;
		this.alive = false;

		this.lastPong = 0;
		this.lastPingTime = Date.now();

		setInterval(() => {
			this.checkStatus();
		}, 10000);
	}

	checkStatus() {
		let t = new Date().getTime();
		if (t - this.lastPong > 30000) {
			this.alive = false;
			console.log('okex websocket not available');
			process.exit();
		} else {
			this.alive = true;
		}
	}

	pong() {
		let gap = Date.now() - this.lastPingTime;
		debug('on pong', gap);
		this.lastPong = new Date().getTime();
	}

	_send(channel, params) {
		params = params ? params : {};
		params['api_key'] = this.key;
		params['sign'] = sign(params, this.secret);

		let data = {'event':'addChannel', 'channel':channel, 'parameters':params};

		debug('send', data);
		this.ws.send(JSON.stringify(data));
	}

	subscribe(channels) {
		let socketURL = 'wss://real.okex.com:10440/websocket/okexapi';
		let ws = new WS(socketURL); 
		this.ws = ws;

		channels.addChannel = (data) => {
			if (data && data.result) {
				console.log(clor.green('okex websocket channel subscribed').toString(), data.channel);
			} else {
				console.log(clor.red('okex websocket subscribe failed channel = ').toString(), data.channel);
			}
		};

		ws.on('open', () => {
			debug('on open');
			this.connected = true;
			console.log('okex websocket connected');

			if (this.key && this.key.length > 1) {
				let loginParams = {
					api_key: this.key
				};
				loginParams.sign = sign(loginParams, this.secret);
				ws.send(JSON.stringify({
					event: 'login',
					parameters: loginParams
				}).replace(/\"/g, "'"));

				debug('send', {
					event: 'login',
					parameters: loginParams
				});
			}


			Object.keys(channels).map(name => {
				if (name === 'addChannel' || name === 'ok_sub_futureusd_userinfo' || name === 'ok_sub_futureusd_positions' || name === 'ok_sub_futureusd_trades') return;
				let d = {event: 'addChannel', channel: name};
				let _d = JSON.stringify(d).replace(/\"/g, "'");
				debug('send', _d);
				ws.send(_d);
			});

			setInterval(() => {
				this.lastPingTime = Date.now();
				ws.send("{'event':'ping'}");
			}, 5000);
		});

		let connected = false;

		ws.on('message', (data) => {
			debug('message', data.substr(0, 300));
			let messages = JSON.parse(data);
			if (messages && messages.event === 'pong') {
				this.pong();
				return;
			}

			messages.forEach(message => {
				if (message['channel'] === 'login') {
					if (message['data'] && message['data'].result) {
						console.log(clor.green('okex websocket login success').toString());
					} else {
						console.error(clor.red('okex websocket login faild').toString(), message);
						process.exit();
						return;
					}
					return;
				}

				if (!connected) {
					if (this.options.onConnect && typeof this.options.onConnect === 'function') {
						this.options.onConnect();
					}
				}
				connected = true;

				let callback = channels[message['channel']];
				if (!callback) {
					// if (message.type === 'order' && message.data && this.options.onTrade) {
					// 	this.options.onTrade(message.data);
					// }
					// console.log('unhandled message', clor.red(JSON.stringify(message, null, '\t')) + '');
					return;
				} 

				if (message['errorcode']) {
					message['errormessage'] = errorMessage(message['errorcode']);
					callback(null, message);
				} else if (message['data']) {
					callback(message['data']);
				}
			});
		});

		ws.on('error', (err) => {
			console.log('okex websocket error', err);
		});

		ws.on('close', () => {
			this.connected = false;
			console.log('okex websocket closed');
		});
	}
}

function sign(params, secret) {
	return md5(stringifyTookexFormat(params) + '&secret_key=' + secret).toUpperCase();
}

/* snippet from okex-API project */
function stringifyTookexFormat(obj) {
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
		10000: '必填参数为空',
		10001: '参数错误',
		10002: '验证失败',
		10003: '该连接已经请求了其他用户的实时交易数据',
		10004: '该连接没有请求此用户的实时交易数据',
		10005: '系统错误',
		10008: '非法参数',
		10009: '订单不存在',
		10010: '余额不足',
		10011: '卖的数量小于BTC/LTC最小买卖额度',
		10012: '当前网站暂时只支持btc_usd ltc_usd',
		10014: '下单价格不得≤0或≥1000000',
		10015: '暂不支持此channel订阅',
		10016: '币数量不足',
		10017: 'WebSocket鉴权失败',
		10100: '用户被冻结',
		10049: '小额委托（<0.15BTC)的未成交委托数量不得大于50个',
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
		20011: '开仓前保证金率超过90%',
		20012: '开仓后保证金率超过90%',
		20013: '暂无对手价',
		20014: '系统错误',
		20015: '订单信息不存在',
		20016: '平仓数量是否大于同方向可用持仓数量',
		20017: '非本人操作',
		20018: '下单价格高于前一分钟的105%或低于95%',
		20019: '该IP限制不能请求该资源',
		20020: '密钥不存在',
		20021: '指数信息不存在',
		20022: '接口调用错误',
		20023: '逐仓用户',
		20024: 'sign签名不匹配',
		20025: '杠杆比率错误',
		20100: '请求超时',
		20101: '数据格式无效',
		20102: '登录无效',
		20103: '数据事件类型无效',
		20104: '数据订阅类型无效',
		20107: 'SON格式错误'
	};

	if (!codes[code]) {
		return 'okex error code: ' + code + 'is not supported';
	}

	return codes[code];
}

module.exports = okex;
