ex-drivers
===========

Highly unified APIs for the crypto-currency exchanges.



## Supports ##

|                            | zb.com | okex.com spot | okex.com future | bitflyer.jp fx | huobipro.com |
| -------------------------- | ------ | ------------- | --------------- | -------------- | ------------ |
| GetTicker()                | ✅      | ✅             | ✅               | ✅              | ✅            |
| GetDepth()                 | ✅      | ✅             | ✅               | ✅              | ✅            |
| GetAccount()               | ✅      | ✅             | ✅               | ✅              | ✅            |
| GetAccounts()              | ✅      | ✅             |                 |                | ✅            |
| GetAccountsMap()           | ✅      | ✅             |                 |                | ✅            |
| GetPosition()              |        |               | ✅               | ✅              |              |
| Trade()                    | ✅      | ✅             | ✅               | ✅              | ✅            |
| Buy() / Sell()             | ✅      | ✅             |                 |                | ✅            |
| Long() / Short()           |        |               | ✅               | ✅              |              |
| CloseLong() / CloseShort() |        |               | ✅               |                |              |
| ws available               | ✅      | ✅             | ✅               | ✅              | ✅            |
| ws depth stream            | ✅      | ✅             | ✅               | ✅              | ✅            |
| ws ticker stream           | ✅      | ✅             | ✅               | ✅              | ✅            |
| GetOrder()                 | ✅      | ✅             | ✅               | ✅              | ✅            |
| CancelOrder()              | ✅      | ✅             | ✅               | ✅              | ✅            |
| CancelPendingOrders()      | ✅      | ✅             | ✅               | ✅              | ✅            |
| GetOrders()                | ✅      | ✅             | ✅               | ✅              | ✅            |
| GetMarkets()               | ✅      | ✅             |                 |                |              |
| GetMarketsMap()            | ✅      | ✅             |                 |                |              |
| GetMarket()                | ✅      | ✅             |                 |                |              |
|                            |        |               |                 |                |              |
|                            |        |               |                 |                |              |
|                            |        |               |                 |                |              |
|                            |        |               |                 |                |              |






APIs:
=====


`GetAccount()`  get account information

```
{
	Balance: float,
	Stocks: float,
	FrozenBalance: float,
	FrozenStocks: float,
	Info: {...original object from exchange api}
}
```

`GetAccounts()`  get account information of all coins

```
[
	{
		Currency: 'BTC',
		Free: float,
		Frozen: float,
		Info: {...original object from exchange api}
	}
]
```

`GetTicker([Currency[, BaseCurrency]])`  get ticker data

```
{
	Open: float,
	High: float,
	Low: float,
	Close: float,
	Volume: float,
	Time: timestamp
}
```

`GetDepth([Currency[, BaseCurrency]])`  get depth data

```
{
	Asks: [ {
			Price: float,
			Amount: float
		},
		...
	],
	Bids: [
		...
	]
}
```


`GetTrades(page = 1)` get finished trade history

```
[
	{
		Id: string,
		Price: float,
		Amount: float,
		DealAmount: float,
		AvgPrice: float,
		Status: Cancelled || Closed,
		Info: {...original object from exchange api}
	},
	...
]
```

`GetMarkets()` get markets information of the exchange
```
[
	{
		Currency: String,
		BaseCurrency: String,
		Decimals: integer,
		StockDecimals: integer,
		MinTradeAmount: float
	},
	...
]
```

`GetMarket(Currency, BaseCurrency)` get market information by currency and base currency
```
{
	Currency: String,
	BaseCurrency: String,
	Decimals: integer,
	StockDecimals: integer,
	MinTradeAmount: float
}
```


### ZB now support multiple subscriptions
```
let zb = new ex({
	Currency: 'BTC',
	BaseCurrency: 'QC',
	Key: config.zb.key,
	Secret: config.zb.secret,
	isWS: true,
	onDepth(data) {
		console.log('onDepth', data);
	},
	onTicker(data) {
		console.log('onTicker', data);
	},
	onPublicTrades(data) {
		console.log('onPublicTrades', data);
	}
});

//subscribe more data
zb.Subscribe('EOS', 'QC', 'Depth');
zb.Subscribe('EOS', 'QC', 'Ticker');
zb.Subscribe('EOS', 'QC', 'PublicTrades');
```




Utils
======

### Usage ###

const { utils } = require('ex-drivers');

### Methods ###

`getPriceFromDepthByAmount(entries, amount)`  get worst price if you send a market order (fixed amount) to the exchange.

`entries` is `Asks` or `Bids` data from the `GetDepth()` result. like following data for example:

```javascript
const Bids = [
	{Price: 100, Amount: 0.1},
	{Price: 99, Amount: 0.1},
	{Price: 98, Amount: 0.1},
	{Price: 97, Amount: 0.1},
	{Price: 96, Amount: 0.1}
];
console.log(utils.getPriceFromDepthByAmount(Bids, 0.3));
//will output 98
console.log(utils.getPriceFromDepthByAmount(Bids, 0.01));
//will output 100
```



`getPriceFromDepthByMoney(entries, money)`  get worst price if you send market order (fixed money) to the exchange.



`getTakerInfoFromDepthByPrice(entries, price)` get detail info if you send market order to the exchange for a fixed price. 

`getTakerInfoFromDepthByAmount(entries, amount)` get detail info if you send market order to the exchange for a fixed amount.

the two methods above will output results like the following:

```javascript
{
    Amount: 2,  //total amount used by the market order
    Money: 1000, //total money used by the market order
    AvgPrice: 500 //average price of this market order
}
```






