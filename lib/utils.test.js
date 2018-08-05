const { utils } = require('../index.js');
const assert = require('better-assert');


const Asks = [
	{Price: 100.1, Amount: 0.1},
	{Price: 101, Amount: 0.1},
	{Price: 102, Amount: 0.1},
	{Price: 103, Amount: 0.1},
	{Price: 104, Amount: 0.1}
];

const Bids = [
	{Price: 100, Amount: 0.1},
	{Price: 99, Amount: 0.1},
	{Price: 98, Amount: 0.1},
	{Price: 97, Amount: 0.1},
	{Price: 96, Amount: 0.1}
];


describe('test utils', function() {
	this.timeout(10000);

	it("test getPriceFromDepthByAmount", () => {
		assert(utils.getPriceFromDepthByAmount(Bids, 0.3) === 98);
		assert(utils.getPriceFromDepthByAmount(Asks, 0.33) === 103);

		assert(utils.getPriceFromDepthByAmount(Bids, 0.01) === 100);
		assert(utils.getPriceFromDepthByAmount(Asks, 0.01) === 100.1);

		assert(utils.getPriceFromDepthByAmount(Bids, 100) === 96);
		assert(utils.getPriceFromDepthByAmount(Asks, 100) === 104);
	});

	it('test getTakerInfoFromDepthByPrice', () => {
		let { Amount, Money, AvgPrice } = utils.getTakerInfoFromDepthByPrice(Bids, 99);
		assert(Amount === 0.2);
		assert(Money === 19.9);
		assert(AvgPrice === 99.5);
	});

	it('test getTakerInfoFromDepthByPrice', () => {
		let { Amount, Money, AvgPrice } = utils.getTakerInfoFromDepthByPrice(Bids, 101);
		assert(Amount === 0);
		assert(Money === 0);
		assert(AvgPrice === 0);
	});

	it('test getTakerInfoFromDepthByPrice', () => {
		let { Amount, Money, AvgPrice } = utils.getTakerInfoFromDepthByPrice(Bids, 10);
		assert(Amount === 0.5);
		assert(Money === 49);
		assert(AvgPrice === 98);
	});

	it('test getTakerInfoFromDepthByAmount', () => {
		let { Amount, Money, AvgPrice } = utils.getTakerInfoFromDepthByAmount(Asks, 0.2);
		assert(Amount === 0.2);
		assert(Money === 20.11);
		assert(AvgPrice === 100.55);
	});

	it('test getTakerInfoFromDepthByAmount', () => {
		let { Amount, Money, AvgPrice } = utils.getTakerInfoFromDepthByAmount(Bids, 0);
		assert(Amount === 0);
		assert(Money === 0);
		assert(AvgPrice === 0);
	});

	it('test getTakerInfoFromDepthByAmount', () => {
		let { Amount, Money, AvgPrice } = utils.getTakerInfoFromDepthByAmount(Bids, 0.5);
		assert(Amount === 0.5);
		assert(Money === 49);
		assert(AvgPrice === 98);
	});

	it('test getTakerInfoFromDepthByAmount', () => {
		let { Amount, Money, AvgPrice } = utils.getTakerInfoFromDepthByAmount(Asks, 0.2);
		assert(Amount === 0.2);
		assert(Money === 20.11);
		assert(AvgPrice === 100.55);
	});
});