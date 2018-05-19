const nodefetch = require('node-fetch');
const fetch = require('../lib/fetch');

describe('test fetch', function() {
	this.timeout(10000000);

	it('node-fetch', async () => {
		for (let i = 0; i < 10; i++) {
			await nodefetch('http://www.163.com/favicon.ico').then(res => res.text());
		}
	});


	it('request fetch', async () => {
		for (let i = 0; i < 10; i++) {
			await fetch('http://www.163.com/favicon.ico', {
				forever: true
			});
		}
	});
	
});