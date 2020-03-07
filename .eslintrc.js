module.exports = {
	env: {
		es6: true,
		node: true,
	},
	extends: [
		'airbnb-base',
	],
	globals: {
		Atomics: 'readonly',
		SharedArrayBuffer: 'readonly',
	},
	parserOptions: {
		ecmaVersion: 2018,
		sourceType: 'module',
	},
	rules: {
		'no-console': 'off',
		"object-curly-newline": ["error", {
			"ObjectExpression": {
				"multiline": true
			},
			"ObjectPattern": {
				"multiline": true
			},
			"ImportDeclaration": "never",
			"ExportDeclaration": {
				"multiline": true,
				"minProperties": 2
			}
		}],
	}
};
