
class ExError extends Error {

	constructor(code, msg, origError) {
		super(msg);
		this.code = code;
		this.original = origError || null;
	}

}

module.exports = ExError;