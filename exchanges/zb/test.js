const ex = require('./index.js');
const config = require('../../accounts.config.json');
const wait = require('delay');


let trades = {};
let zb = new ex({
	Currency: 'USDT',
	BaseCurrency: 'QC',
	Key: config.zb_zhujing_mother.key,
	Secret: config.zb_zhujing_mother.secret,
	isWS: true,
	// onDepth(d1) {
	// 	console.log('depth');	
	// },
	// onTrades(trades) {
	// 	let newT = 0, repeated = 0;
	// 	trades.map(t => {
	// 		if (!trades[t.Id]) {
	// 			console.log(t);
	// 			newT++;
	// 			trades[t.Id] = 1;
	// 		} else {
	// 			repeated++;
	// 		}
	// 	});
	// 	console.log('new=', newT, 'repeated=', repeated);
	// }
});



async function onDepth(d1) {
	d1.Asks.reverse();
	d1.Asks = d1.Asks.slice(0,3);
	d1.Bids = d1.Bids.slice(0,3);
	let d2 = await zb.GetDepth();
	d2.Asks.reverse();
	d2.Asks = d2.Asks.slice(0,3);
	d2.Bids = d2.Bids.slice(0,3);
	console.log('d1=', d1);
	console.log('d2=', d2);
}

(async function() {
		await zb.GetAccount().then(console.log).catch(console.log);
		// await wait(1000);

		await zb.waitUntilWSReady();

		// let pendingOrders = await zb.rest.GetOrders().catch(console.error);
		// console.log(pendingOrders, pendingOrders.length);
		console.log(await zb.ws.GetOrders().catch(console.error));

		// console.log(await zb.CancelPendingOrders().catch(console.error));

		// await zb.GetAccount().then(console.log).catch(console.log);
})();