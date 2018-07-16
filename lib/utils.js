const N = require('precise-number');

let utils = {

	getPriceFromDepthByAmount(entries, amount) {
		return utils._getPriceFromDepth(entries, 'amount', amount);
	},

	getPriceFromDepthByMoney(entries, money) {
		return utils._getPriceFromDepth(entries, 'money', money);
	},

	_getPriceFromDepth(entries, type, tolerance) {
		if (!entries || entries.length === 0) throw 'entries is empty';
		let accumulatedAmount = 0;
		for (let i = 0; i < entries.length; i++) {
			let entry = entries[i];

			if (type === 'amount') {
				accumulatedAmount += entry.Amount;
			} else {
				accumulatedAmount += entry.Amount * entry.Price;
			}
			if ( tolerance <= accumulatedAmount) {
				return entry.Price;
			}
		}
		return entries[entries.length - 1].Price;
	},

	_isBidsOrAsks(entries) {
		if (!entries || entries.length <= 1) throw new Error('no entries');
		return entries[0].Price > entries[entries.length - 1].Price ? 'Bids' : 'Asks';
	},

	getTakerInfoFromDepthByPrice(entries, price) {
		let type = utils._isBidsOrAsks(entries);
		let re = entries.reduce((info, e) => {
			if ((type === 'Bids' && e.Price >= price) || (type === 'Asks' && e.Price <= price)) {
				info.Amount = N(info.Amount).add(e.Amount) * 1;
				info.Money = N(info.Money).add(N(e.Amount).multiply(e.Price)) * 1;
			}
			return info;
		}, { Money:0, Amount:0 });
		re.AvgPrice = (re.Amount > 0) ? N.div(re.Money, re.Amount) : 0;
		return re;
	},

	getTakerInfoFromDepthByAmount(entries, amount) {
		let re = entries.reduce((info, e) => {
			if (info.Amount < amount) {
				info.Amount = N(info.Amount).add(e.Amount) * 1;
				info.Money = N(info.Money).add(N(e.Amount).multiply(e.Price)) * 1;
			}
			return info;
		}, { Money:0, Amount:0 });
		re.AvgPrice = (re.Amount > 0) ? N.div(re.Money, re.Amount) : 0;
		return re;
	}
};

module.exports = utils;