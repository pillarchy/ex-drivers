const Agent = require('agentkeepalive');

//https://github.com/node-modules/agentkeepalive

let options = {
	maxSockets: 20,
	maxFreeSockets: 5,
	freeSocketKeepAliveTimeout: 30000
};

let https = new Agent.HttpsAgent(options);

module.exports = {
	http: new Agent(options),
	https
};