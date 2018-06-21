ex-drivers
===========




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

`GetTicker()`  get ticker data

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


`GetTrades(page = 1)` get trade history

```
[
	{
		Id: string,
		Price: float,
		Amount: float,
		DealAmount: float,
		AvgPrice: float,
		Status: Pendding || Cancelled || Closed,
		Info: {...original object from exchange api}
	},
	...
]
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
zb.SubscribeDepth('EOS', 'QC');
zb.SubscribeTicker('EOS', 'QC');
zb.SubscribePublicTrades('EOS', 'QC');
```





