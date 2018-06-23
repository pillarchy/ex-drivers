const nock = require('nock');
nock('https://trade.bitkk.com').persist().get(/\/api\/getAccountInfo/).reply(200, {
	"result": {
		"coins": [
			{
				"enName": "ZB",
				"freez": "87500",
				"fundstype": 51,
				"unitDecimal": 8,
				"cnName": "ZB",
				"isCanRecharge": false,
				"unitTag": "ZB",
				"isCanWithdraw": false,
				"available": "12400.00719382",
				"canLoan": false,
				"key": "zb"
			},
			{
				"enName": "QC",
				"freez": "0.00000000",
				"fundstype": 15,
				"unitDecimal": 8,
				"cnName": "QC",
				"isCanRecharge": true,
				"unitTag": "QC",
				"isCanWithdraw": true,
				"available": "43222.01840989",
				"canLoan": true,
				"key": "qc"
			},
			{
				"enName": "USDT",
				"freez": "0.00000000",
				"fundstype": 13,
				"unitDecimal": 8,
				"cnName": "USDT",
				"isCanRecharge": true,
				"unitTag": "$",
				"isCanWithdraw": true,
				"available": "19093.5454368",
				"canLoan": true,
				"key": "usdt"
			},
			{
				"enName": "BTC",
				"freez": "0.4999",
				"fundstype": 2,
				"unitDecimal": 8,
				"cnName": "BTC",
				"isCanRecharge": true,
				"unitTag": "฿",
				"isCanWithdraw": true,
				"available": "0.0001",
				"canLoan": true,
				"key": "btc"
			}
		],
		"base": {
			"username": "18980562652",
			"trade_password_enabled": true,
			"auth_google_enabled": true,
			"auth_mobile_enabled": true
		}
	},
	"assetPerm": true,
	"leverPerm": true,
	"entrustPerm": true,
	"moneyPerm": true
}).get(/api\/order\b/).reply(200, {
	result: {
		id: Date.now()
	}
});