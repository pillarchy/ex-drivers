const debug = require('debug')('killer');


/**
 * auto-killer is a process killer
 * you have to keep say hi() to him
 * otherwise he will kill current process after specific time
 */

class AutoKiller {

	/**
	 * timeout  	integer		keep alive time in ms
	 * msg			string 		it will log this message when kill
	 * beforeKill 	function 	call this function instead of killing process directly
	 */
	constructor(timeout, msg, beforeKill) {
		this.timeout = timeout;
		this.setTimer();
		this.msg = msg || '';
		this.beforeKill = beforeKill;
		debug('new auto-killer');
	}

	setTimer() {
		try {
			clearTimeout(this.timer);
		} catch (err) {}
		this.timer = setTimeout(async () => {
			let msg = 'auto killer will kill this process, reason: ' + this.msg;
			console.log(msg);
			if (this.beforeKill) {
				await this.beforeKill(msg);
			} else {
				process.exit();
			}
		}, this.timeout);
		debug('set timer', this.timeout);
	}

	hi() {
		debug('i am alive');
		this.setTimer();
	}

}


module.exports = AutoKiller;

