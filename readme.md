ex-drivers
===========




APIs:
=====


`GetAccount()`

```
{
	Balance: float,
	Stocks: float,
	FrozenBalance: float,
	FrozenStocks: float,
	Info: {...original object from exchange api}
}
```

`GetAccounts()`

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

`GetTicker()`

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

