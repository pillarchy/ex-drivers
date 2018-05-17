const ex = require('./index.js');
const config = require('../../accounts.config.json');

let zb = new ex({
	Currency: 'BTC',
	BaseCurrency: 'USDT',
	Key: config.zb_zhujing.key,
	Secret: config.zb_zhujing.secret,
	isWS: true,
	// onDepth(data) {
	// 	console.log('onDepth', data);
	// },
	onTicker(data) {
		// console.log('onTicker', data);
	},
	// onTrades(data) {
	// 	console.log('onTrades', data);
	// }
});

setTimeout(async () => {

	await zb.GetOrders().then(d => {
		console.log(d);
	});


	await zb.GetOrder('201712127040792').then(console.log);

	await zb.CancelOrder('201712127040792').then(console.log);
	// await zb.Sell(23000, 0.01).then(data=>{
	// 	console.log('sell', data);
	// }).catch(err => {
	// 	console.log('sell error', err);
	// });
	// 
	
	await zb.CancelPendingOrders();

	await zb.GetOrders().then(d => {
		console.log(d);
	});
	
	await zb.GetAccount().then(data => {
		console.log('getAccount', data);
	}).catch(err => {
		console.log('get account error', err);
	});

}, 2000);