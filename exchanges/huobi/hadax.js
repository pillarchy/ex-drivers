const HUOBI = require('./index.js');

class HADAX extends HUOBI {

	constructor(options) {
		options.hadax = true;
		super(options);
	}

}

module.exports = HADAX;