class Queue {

	constructor(timeout) {
		this.timeout = timeout ? timeout : 5000;
		this.queue = [];
	}

	push(actions) {
		return new Promise( (done, reject) => {
			let obj = {
				done,
				reject,
				time: new Date().getTime(),
				finished: false
			};
			this.queue.push(obj);
			setTimeout(() => {
				if (!obj.finished) {
					this.reject({error:true, success: false, errormessage: 'timeout (' + this.timeout + 'ms)'});
				}
			}, this.timeout);
			if (actions && typeof actions === 'function') actions();
		});
	}

	done(data) {
		let obj = this.queue.shift();
		if (!obj) return;
		obj.finished = true;
		return obj.done(data);
	}

	reject(err) {
		let obj = this.queue.shift();
		if (!obj) return;
		obj.finished = true;
		return obj.reject(err);
	}

	finish(err, data) {
		if (err) {
			return this.reject(err);
		} else {
			return this.done(data);
		}
	}
}


module.exports = Queue;