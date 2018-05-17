const { EventEmitter } = require('events');

class DelayTrigger extends EventEmitter {

	constructor(delay) {
		super();
		this.delay = delay;
		this.timers = {};
	}

	trigger(name, data) {
		try {
			if (this.timers[name]) clearTimeout(this.timers[name]);
		} catch (err) {}
		this.timers[name] = setTimeout(() => {
			this.emit(name, data);
		}, this.delay);
	}
}

module.exports = DelayTrigger;