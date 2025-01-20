#!/usr/bin/env node

if (require.main === module) {
	require('../out/index.js')
}
else {
	throw new Error('link must be run as a CLI!')
}