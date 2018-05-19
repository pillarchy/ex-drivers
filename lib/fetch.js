/**
 * a request based fetch
 */

const rp = require('request-promise-native');
function rpf(url, options = {}) {
	options.url = url;
	options.resolveWithFullResponse = true;
	return rp(options).then(res => {
		res.json = () => {
			try {
				return JSON.parse(res.body);
			} catch (err) {
				let erro = new Error('can not parse response to json object:' + err.message);
				erro.response = res;
				throw erro;
			}
		};

		res.text = () => res.body;
		return res;
	});
}

module.exports = rpf;