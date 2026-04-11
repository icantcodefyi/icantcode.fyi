import { createRequire } from "node:module";
import { handle } from "hono/vercel";
import "dotenv/config";
import { z } from "zod";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { ORPCError, onError, os } from "@orpc/server";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

//#region rolldown:runtime
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJSMin = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);
var __export = (all, symbols) => {
	let target = {};
	for (var name in all) {
		__defProp(target, name, {
			get: all[name],
			enumerable: true
		});
	}
	if (symbols) {
		__defProp(target, Symbol.toStringTag, { value: "Module" });
	}
	return target;
};
var __copyProps = (to, from, except$1, desc$1) => {
	if (from && typeof from === "object" || typeof from === "function") {
		for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
			key = keys[i];
			if (!__hasOwnProp.call(to, key) && key !== except$1) {
				__defProp(to, key, {
					get: ((k) => from[k]).bind(null, key),
					enumerable: !(desc$1 = __getOwnPropDesc(from, key)) || desc$1.enumerable
				});
			}
		}
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));
var __require = /* @__PURE__ */ createRequire(import.meta.url);

//#endregion
//#region ../../node_modules/.bun/@t3-oss+env-core@0.13.11+cb1677c2d8bd2708/node_modules/@t3-oss/env-core/dist/standard.js
function ensureSynchronous(value, message) {
	if (value instanceof Promise) throw new Error(message);
}
function parseWithDictionary(dictionary, value) {
	const result = {};
	const issues = [];
	for (const key in dictionary) {
		const propResult = dictionary[key]["~standard"].validate(value[key]);
		ensureSynchronous(propResult, `Validation must be synchronous, but ${key} returned a Promise.`);
		if (propResult.issues) {
			issues.push(...propResult.issues.map((issue) => ({
				...issue,
				message: issue.message,
				path: [key, ...issue.path ?? []]
			})));
			continue;
		}
		result[key] = propResult.value;
	}
	if (issues.length) return { issues };
	return { value: result };
}

//#endregion
//#region ../../node_modules/.bun/@t3-oss+env-core@0.13.11+cb1677c2d8bd2708/node_modules/@t3-oss/env-core/dist/index.js
/**
* Create a new environment variable schema.
*/
function createEnv(opts) {
	const runtimeEnv = opts.runtimeEnvStrict ?? opts.runtimeEnv ?? process.env;
	if (opts.emptyStringAsUndefined ?? false) {
		for (const [key, value] of Object.entries(runtimeEnv)) if (value === "") delete runtimeEnv[key];
	}
	if (!!opts.skipValidation) {
		if (opts.extends) for (const preset of opts.extends) preset.skipValidation = true;
		return runtimeEnv;
	}
	const _client = typeof opts.client === "object" ? opts.client : {};
	const _server = typeof opts.server === "object" ? opts.server : {};
	const _shared = typeof opts.shared === "object" ? opts.shared : {};
	const isServer = opts.isServer ?? (typeof window === "undefined" || "Deno" in window);
	const finalSchemaShape = isServer ? {
		..._server,
		..._shared,
		..._client
	} : {
		..._client,
		..._shared
	};
	const parsed = (opts.createFinalSchema?.(finalSchemaShape, isServer))?.["~standard"].validate(runtimeEnv) ?? parseWithDictionary(finalSchemaShape, runtimeEnv);
	ensureSynchronous(parsed, "Validation must be synchronous");
	const onValidationError = opts.onValidationError ?? ((issues) => {
		console.error("❌ Invalid environment variables:", issues);
		throw new Error("Invalid environment variables");
	});
	const onInvalidAccess = opts.onInvalidAccess ?? (() => {
		throw new Error("❌ Attempted to access a server-side environment variable on the client");
	});
	if (parsed.issues) return onValidationError(parsed.issues);
	const isServerAccess = (prop) => {
		if (!opts.clientPrefix) return true;
		return !prop.startsWith(opts.clientPrefix) && !(prop in _shared);
	};
	const isValidServerAccess = (prop) => {
		return isServer || !isServerAccess(prop);
	};
	const ignoreProp = (prop) => {
		return prop === "__esModule" || prop === "$$typeof";
	};
	const extendedObj = (opts.extends ?? []).reduce((acc, curr) => {
		return Object.assign(acc, curr);
	}, {});
	const fullObj = Object.assign(extendedObj, parsed.value);
	return new Proxy(fullObj, { get(target, prop) {
		if (typeof prop !== "string") return void 0;
		if (ignoreProp(prop)) return void 0;
		if (!isValidServerAccess(prop)) return onInvalidAccess(prop);
		return Reflect.get(target, prop);
	} });
}

//#endregion
//#region ../../packages/env/src/server.ts
/**
* Accepts either a single URL or a comma-separated list of URLs.
* Returns a normalised `string[]` so Hono's `cors({ origin })`
* (which accepts `string | string[]`) gets the full allowlist.
*/
const corsOriginSchema = z.string().min(1).transform((raw) => raw.split(",").map((entry) => entry.trim()).filter(Boolean)).pipe(z.array(z.url()).min(1));
/**
* `clientPrefix: ""` + empty `client: {}` narrows @t3-oss/env-core's
* internal `TPrefix` generic to the literal `""`. Without it, some build
* environments (notably Vercel's tsc run) fail to narrow `TPrefix` at all
* and widen it to `string`, which makes every server key trip the
* "should not be prefixed with ${string}" guard in `ServerOptions`.
*
* See env-core's `ServerOptions` type:
*   TPrefix extends "" ? TServer[TKey] : ... ErrorMessage<...>
* An explicit empty prefix always takes the first branch.
*/
const env = createEnv({
	clientPrefix: "",
	client: {},
	server: {
		DATABASE_URL: z.string().min(1),
		BETTER_AUTH_SECRET: z.string().min(32),
		BETTER_AUTH_URL: z.url(),
		CORS_ORIGIN: corsOriginSchema,
		NODE_ENV: z.enum([
			"development",
			"production",
			"test"
		]).default("development"),
		SPOTIFY_CLIENT_ID: z.string().optional(),
		SPOTIFY_CLIENT_SECRET: z.string().optional(),
		SPOTIFY_REFRESH_TOKEN: z.string().optional(),
		GOOGLE_CLIENT_ID: z.string().min(1),
		GOOGLE_CLIENT_SECRET: z.string().min(1)
	},
	runtimeEnv: process.env,
	emptyStringAsUndefined: true
});

//#endregion
//#region ../../node_modules/.bun/postgres-array@2.0.0/node_modules/postgres-array/index.js
var require_postgres_array = /* @__PURE__ */ __commonJSMin(((exports) => {
	exports.parse = function(source, transform$1) {
		return new ArrayParser(source, transform$1).parse();
	};
	var ArrayParser = class ArrayParser {
		constructor(source, transform$1) {
			this.source = source;
			this.transform = transform$1 || identity;
			this.position = 0;
			this.entries = [];
			this.recorded = [];
			this.dimension = 0;
		}
		isEof() {
			return this.position >= this.source.length;
		}
		nextCharacter() {
			var character = this.source[this.position++];
			if (character === "\\") return {
				value: this.source[this.position++],
				escaped: true
			};
			return {
				value: character,
				escaped: false
			};
		}
		record(character) {
			this.recorded.push(character);
		}
		newEntry(includeEmpty) {
			var entry;
			if (this.recorded.length > 0 || includeEmpty) {
				entry = this.recorded.join("");
				if (entry === "NULL" && !includeEmpty) entry = null;
				if (entry !== null) entry = this.transform(entry);
				this.entries.push(entry);
				this.recorded = [];
			}
		}
		consumeDimensions() {
			if (this.source[0] === "[") {
				while (!this.isEof()) if (this.nextCharacter().value === "=") break;
			}
		}
		parse(nested) {
			var character, parser, quote;
			this.consumeDimensions();
			while (!this.isEof()) {
				character = this.nextCharacter();
				if (character.value === "{" && !quote) {
					this.dimension++;
					if (this.dimension > 1) {
						parser = new ArrayParser(this.source.substr(this.position - 1), this.transform);
						this.entries.push(parser.parse(true));
						this.position += parser.position - 2;
					}
				} else if (character.value === "}" && !quote) {
					this.dimension--;
					if (!this.dimension) {
						this.newEntry();
						if (nested) return this.entries;
					}
				} else if (character.value === "\"" && !character.escaped) {
					if (quote) this.newEntry(true);
					quote = !quote;
				} else if (character.value === "," && !quote) this.newEntry();
				else this.record(character.value);
			}
			if (this.dimension !== 0) throw new Error("array dimension not balanced");
			return this.entries;
		}
	};
	function identity(value) {
		return value;
	}
}));

//#endregion
//#region ../../node_modules/.bun/pg-types@2.2.0/node_modules/pg-types/lib/arrayParser.js
var require_arrayParser = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var array$1 = require_postgres_array();
	module.exports = { create: function(source, transform$1) {
		return { parse: function() {
			return array$1.parse(source, transform$1);
		} };
	} };
}));

//#endregion
//#region ../../node_modules/.bun/postgres-date@1.0.7/node_modules/postgres-date/index.js
var require_postgres_date = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var DATE_TIME = /(\d{1,})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})(\.\d{1,})?.*?( BC)?$/;
	var DATE = /^(\d{1,})-(\d{2})-(\d{2})( BC)?$/;
	var TIME_ZONE = /([Z+-])(\d{2})?:?(\d{2})?:?(\d{2})?/;
	var INFINITY = /^-?infinity$/;
	module.exports = function parseDate$2(isoDate) {
		if (INFINITY.test(isoDate)) return Number(isoDate.replace("i", "I"));
		var matches = DATE_TIME.exec(isoDate);
		if (!matches) return getDate(isoDate) || null;
		var isBC = !!matches[8];
		var year = parseInt(matches[1], 10);
		if (isBC) year = bcYearToNegativeYear(year);
		var month = parseInt(matches[2], 10) - 1;
		var day = matches[3];
		var hour = parseInt(matches[4], 10);
		var minute = parseInt(matches[5], 10);
		var second = parseInt(matches[6], 10);
		var ms = matches[7];
		ms = ms ? 1e3 * parseFloat(ms) : 0;
		var date$1;
		var offset = timeZoneOffset(isoDate);
		if (offset != null) {
			date$1 = new Date(Date.UTC(year, month, day, hour, minute, second, ms));
			if (is0To99(year)) date$1.setUTCFullYear(year);
			if (offset !== 0) date$1.setTime(date$1.getTime() - offset);
		} else {
			date$1 = new Date(year, month, day, hour, minute, second, ms);
			if (is0To99(year)) date$1.setFullYear(year);
		}
		return date$1;
	};
	function getDate(isoDate) {
		var matches = DATE.exec(isoDate);
		if (!matches) return;
		var year = parseInt(matches[1], 10);
		if (!!matches[4]) year = bcYearToNegativeYear(year);
		var month = parseInt(matches[2], 10) - 1;
		var day = matches[3];
		var date$1 = new Date(year, month, day);
		if (is0To99(year)) date$1.setFullYear(year);
		return date$1;
	}
	function timeZoneOffset(isoDate) {
		if (isoDate.endsWith("+00")) return 0;
		var zone = TIME_ZONE.exec(isoDate.split(" ")[1]);
		if (!zone) return;
		var type = zone[1];
		if (type === "Z") return 0;
		var sign = type === "-" ? -1 : 1;
		return (parseInt(zone[2], 10) * 3600 + parseInt(zone[3] || 0, 10) * 60 + parseInt(zone[4] || 0, 10)) * sign * 1e3;
	}
	function bcYearToNegativeYear(year) {
		return -(year - 1);
	}
	function is0To99(num) {
		return num >= 0 && num < 100;
	}
}));

//#endregion
//#region ../../node_modules/.bun/xtend@4.0.2/node_modules/xtend/mutable.js
var require_mutable = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = extend$1;
	var hasOwnProperty = Object.prototype.hasOwnProperty;
	function extend$1(target) {
		for (var i = 1; i < arguments.length; i++) {
			var source = arguments[i];
			for (var key in source) if (hasOwnProperty.call(source, key)) target[key] = source[key];
		}
		return target;
	}
}));

//#endregion
//#region ../../node_modules/.bun/postgres-interval@1.2.0/node_modules/postgres-interval/index.js
var require_postgres_interval = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var extend = require_mutable();
	module.exports = PostgresInterval;
	function PostgresInterval(raw) {
		if (!(this instanceof PostgresInterval)) return new PostgresInterval(raw);
		extend(this, parse$5(raw));
	}
	var properties = [
		"seconds",
		"minutes",
		"hours",
		"days",
		"months",
		"years"
	];
	PostgresInterval.prototype.toPostgres = function() {
		var filtered = properties.filter(this.hasOwnProperty, this);
		if (this.milliseconds && filtered.indexOf("seconds") < 0) filtered.push("seconds");
		if (filtered.length === 0) return "0";
		return filtered.map(function(property) {
			var value = this[property] || 0;
			if (property === "seconds" && this.milliseconds) value = (value + this.milliseconds / 1e3).toFixed(6).replace(/\.?0+$/, "");
			return value + " " + property;
		}, this).join(" ");
	};
	var propertiesISOEquivalent = {
		years: "Y",
		months: "M",
		days: "D",
		hours: "H",
		minutes: "M",
		seconds: "S"
	};
	var dateProperties = [
		"years",
		"months",
		"days"
	];
	var timeProperties = [
		"hours",
		"minutes",
		"seconds"
	];
	PostgresInterval.prototype.toISOString = PostgresInterval.prototype.toISO = function() {
		var datePart = dateProperties.map(buildProperty, this).join("");
		var timePart = timeProperties.map(buildProperty, this).join("");
		return "P" + datePart + "T" + timePart;
		function buildProperty(property) {
			var value = this[property] || 0;
			if (property === "seconds" && this.milliseconds) value = (value + this.milliseconds / 1e3).toFixed(6).replace(/0+$/, "");
			return value + propertiesISOEquivalent[property];
		}
	};
	var NUMBER = "([+-]?\\d+)";
	var YEAR = NUMBER + "\\s+years?";
	var MONTH = NUMBER + "\\s+mons?";
	var DAY = NUMBER + "\\s+days?";
	var INTERVAL = new RegExp([
		YEAR,
		MONTH,
		DAY,
		"([+-])?([\\d]*):(\\d\\d):(\\d\\d)\\.?(\\d{1,6})?"
	].map(function(regexString) {
		return "(" + regexString + ")?";
	}).join("\\s*"));
	var positions = {
		years: 2,
		months: 4,
		days: 6,
		hours: 9,
		minutes: 10,
		seconds: 11,
		milliseconds: 12
	};
	var negatives = [
		"hours",
		"minutes",
		"seconds",
		"milliseconds"
	];
	function parseMilliseconds(fraction) {
		var microseconds = fraction + "000000".slice(fraction.length);
		return parseInt(microseconds, 10) / 1e3;
	}
	function parse$5(interval$1) {
		if (!interval$1) return {};
		var matches = INTERVAL.exec(interval$1);
		var isNegative = matches[8] === "-";
		return Object.keys(positions).reduce(function(parsed, property) {
			var value = matches[positions[property]];
			if (!value) return parsed;
			value = property === "milliseconds" ? parseMilliseconds(value) : parseInt(value, 10);
			if (!value) return parsed;
			if (isNegative && ~negatives.indexOf(property)) value *= -1;
			parsed[property] = value;
			return parsed;
		}, {});
	}
}));

//#endregion
//#region ../../node_modules/.bun/postgres-bytea@1.0.1/node_modules/postgres-bytea/index.js
var require_postgres_bytea = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var bufferFrom = Buffer.from || Buffer;
	module.exports = function parseBytea(input) {
		if (/^\\x/.test(input)) return bufferFrom(input.substr(2), "hex");
		var output = "";
		var i = 0;
		while (i < input.length) if (input[i] !== "\\") {
			output += input[i];
			++i;
		} else if (/[0-7]{3}/.test(input.substr(i + 1, 3))) {
			output += String.fromCharCode(parseInt(input.substr(i + 1, 3), 8));
			i += 4;
		} else {
			var backslashes = 1;
			while (i + backslashes < input.length && input[i + backslashes] === "\\") backslashes++;
			for (var k = 0; k < Math.floor(backslashes / 2); ++k) output += "\\";
			i += Math.floor(backslashes / 2) * 2;
		}
		return bufferFrom(output, "binary");
	};
}));

//#endregion
//#region ../../node_modules/.bun/pg-types@2.2.0/node_modules/pg-types/lib/textParsers.js
var require_textParsers = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var array = require_postgres_array();
	var arrayParser$1 = require_arrayParser();
	var parseDate$1 = require_postgres_date();
	var parseInterval = require_postgres_interval();
	var parseByteA = require_postgres_bytea();
	function allowNull(fn) {
		return function nullAllowed(value) {
			if (value === null) return value;
			return fn(value);
		};
	}
	function parseBool$1(value) {
		if (value === null) return value;
		return value === "TRUE" || value === "t" || value === "true" || value === "y" || value === "yes" || value === "on" || value === "1";
	}
	function parseBoolArray(value) {
		if (!value) return null;
		return array.parse(value, parseBool$1);
	}
	function parseBaseTenInt(string) {
		return parseInt(string, 10);
	}
	function parseIntegerArray(value) {
		if (!value) return null;
		return array.parse(value, allowNull(parseBaseTenInt));
	}
	function parseBigIntegerArray$1(value) {
		if (!value) return null;
		return array.parse(value, allowNull(function(entry) {
			return parseBigInteger$1(entry).trim();
		}));
	}
	var parsePointArray = function(value) {
		if (!value) return null;
		return arrayParser$1.create(value, function(entry) {
			if (entry !== null) entry = parsePoint(entry);
			return entry;
		}).parse();
	};
	var parseFloatArray = function(value) {
		if (!value) return null;
		return arrayParser$1.create(value, function(entry) {
			if (entry !== null) entry = parseFloat(entry);
			return entry;
		}).parse();
	};
	var parseStringArray = function(value) {
		if (!value) return null;
		return arrayParser$1.create(value).parse();
	};
	var parseDateArray = function(value) {
		if (!value) return null;
		return arrayParser$1.create(value, function(entry) {
			if (entry !== null) entry = parseDate$1(entry);
			return entry;
		}).parse();
	};
	var parseIntervalArray = function(value) {
		if (!value) return null;
		return arrayParser$1.create(value, function(entry) {
			if (entry !== null) entry = parseInterval(entry);
			return entry;
		}).parse();
	};
	var parseByteAArray = function(value) {
		if (!value) return null;
		return array.parse(value, allowNull(parseByteA));
	};
	var parseInteger = function(value) {
		return parseInt(value, 10);
	};
	var parseBigInteger$1 = function(value) {
		var valStr = String(value);
		if (/^\d+$/.test(valStr)) return valStr;
		return value;
	};
	var parseJsonArray = function(value) {
		if (!value) return null;
		return array.parse(value, allowNull(JSON.parse));
	};
	var parsePoint = function(value) {
		if (value[0] !== "(") return null;
		value = value.substring(1, value.length - 1).split(",");
		return {
			x: parseFloat(value[0]),
			y: parseFloat(value[1])
		};
	};
	var parseCircle = function(value) {
		if (value[0] !== "<" && value[1] !== "(") return null;
		var point$1 = "(";
		var radius = "";
		var pointParsed = false;
		for (var i = 2; i < value.length - 1; i++) {
			if (!pointParsed) point$1 += value[i];
			if (value[i] === ")") {
				pointParsed = true;
				continue;
			} else if (!pointParsed) continue;
			if (value[i] === ",") continue;
			radius += value[i];
		}
		var result = parsePoint(point$1);
		result.radius = parseFloat(radius);
		return result;
	};
	var init$1 = function(register) {
		register(20, parseBigInteger$1);
		register(21, parseInteger);
		register(23, parseInteger);
		register(26, parseInteger);
		register(700, parseFloat);
		register(701, parseFloat);
		register(16, parseBool$1);
		register(1082, parseDate$1);
		register(1114, parseDate$1);
		register(1184, parseDate$1);
		register(600, parsePoint);
		register(651, parseStringArray);
		register(718, parseCircle);
		register(1e3, parseBoolArray);
		register(1001, parseByteAArray);
		register(1005, parseIntegerArray);
		register(1007, parseIntegerArray);
		register(1028, parseIntegerArray);
		register(1016, parseBigIntegerArray$1);
		register(1017, parsePointArray);
		register(1021, parseFloatArray);
		register(1022, parseFloatArray);
		register(1231, parseFloatArray);
		register(1014, parseStringArray);
		register(1015, parseStringArray);
		register(1008, parseStringArray);
		register(1009, parseStringArray);
		register(1040, parseStringArray);
		register(1041, parseStringArray);
		register(1115, parseDateArray);
		register(1182, parseDateArray);
		register(1185, parseDateArray);
		register(1186, parseInterval);
		register(1187, parseIntervalArray);
		register(17, parseByteA);
		register(114, JSON.parse.bind(JSON));
		register(3802, JSON.parse.bind(JSON));
		register(199, parseJsonArray);
		register(3807, parseJsonArray);
		register(3907, parseStringArray);
		register(2951, parseStringArray);
		register(791, parseStringArray);
		register(1183, parseStringArray);
		register(1270, parseStringArray);
	};
	module.exports = { init: init$1 };
}));

//#endregion
//#region ../../node_modules/.bun/pg-int8@1.0.1/node_modules/pg-int8/index.js
var require_pg_int8 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var BASE = 1e6;
	function readInt8(buffer) {
		var high = buffer.readInt32BE(0);
		var low = buffer.readUInt32BE(4);
		var sign = "";
		if (high < 0) {
			high = ~high + (low === 0);
			low = ~low + 1 >>> 0;
			sign = "-";
		}
		var result = "";
		var carry;
		var t;
		var digits;
		var pad;
		var l;
		var i;
		carry = high % BASE;
		high = high / BASE >>> 0;
		t = 4294967296 * carry + low;
		low = t / BASE >>> 0;
		digits = "" + (t - BASE * low);
		if (low === 0 && high === 0) return sign + digits + result;
		pad = "";
		l = 6 - digits.length;
		for (i = 0; i < l; i++) pad += "0";
		result = pad + digits + result;
		carry = high % BASE;
		high = high / BASE >>> 0;
		t = 4294967296 * carry + low;
		low = t / BASE >>> 0;
		digits = "" + (t - BASE * low);
		if (low === 0 && high === 0) return sign + digits + result;
		pad = "";
		l = 6 - digits.length;
		for (i = 0; i < l; i++) pad += "0";
		result = pad + digits + result;
		carry = high % BASE;
		high = high / BASE >>> 0;
		t = 4294967296 * carry + low;
		low = t / BASE >>> 0;
		digits = "" + (t - BASE * low);
		if (low === 0 && high === 0) return sign + digits + result;
		pad = "";
		l = 6 - digits.length;
		for (i = 0; i < l; i++) pad += "0";
		result = pad + digits + result;
		carry = high % BASE;
		t = 4294967296 * carry + low;
		digits = "" + t % BASE;
		return sign + digits + result;
	}
	module.exports = readInt8;
}));

//#endregion
//#region ../../node_modules/.bun/pg-types@2.2.0/node_modules/pg-types/lib/binaryParsers.js
var require_binaryParsers = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var parseInt64 = require_pg_int8();
	var parseBits = function(data, bits, offset, invert, callback) {
		offset = offset || 0;
		invert = invert || false;
		callback = callback || function(lastValue, newValue, bits$1) {
			return lastValue * Math.pow(2, bits$1) + newValue;
		};
		var offsetBytes = offset >> 3;
		var inv = function(value) {
			if (invert) return ~value & 255;
			return value;
		};
		var mask = 255;
		var firstBits = 8 - offset % 8;
		if (bits < firstBits) {
			mask = 255 << 8 - bits & 255;
			firstBits = bits;
		}
		if (offset) mask = mask >> offset % 8;
		var result = 0;
		if (offset % 8 + bits >= 8) result = callback(0, inv(data[offsetBytes]) & mask, firstBits);
		var bytes = bits + offset >> 3;
		for (var i = offsetBytes + 1; i < bytes; i++) result = callback(result, inv(data[i]), 8);
		var lastBits = (bits + offset) % 8;
		if (lastBits > 0) result = callback(result, inv(data[bytes]) >> 8 - lastBits, lastBits);
		return result;
	};
	var parseFloatFromBits = function(data, precisionBits, exponentBits) {
		var bias = Math.pow(2, exponentBits - 1) - 1;
		var sign = parseBits(data, 1);
		var exponent = parseBits(data, exponentBits, 1);
		if (exponent === 0) return 0;
		var precisionBitsCounter = 1;
		var parsePrecisionBits = function(lastValue, newValue, bits) {
			if (lastValue === 0) lastValue = 1;
			for (var i = 1; i <= bits; i++) {
				precisionBitsCounter /= 2;
				if ((newValue & 1 << bits - i) > 0) lastValue += precisionBitsCounter;
			}
			return lastValue;
		};
		var mantissa = parseBits(data, precisionBits, exponentBits + 1, false, parsePrecisionBits);
		if (exponent == Math.pow(2, exponentBits + 1) - 1) {
			if (mantissa === 0) return sign === 0 ? Infinity : -Infinity;
			return NaN;
		}
		return (sign === 0 ? 1 : -1) * Math.pow(2, exponent - bias) * mantissa;
	};
	var parseInt16 = function(value) {
		if (parseBits(value, 1) == 1) return -1 * (parseBits(value, 15, 1, true) + 1);
		return parseBits(value, 15, 1);
	};
	var parseInt32 = function(value) {
		if (parseBits(value, 1) == 1) return -1 * (parseBits(value, 31, 1, true) + 1);
		return parseBits(value, 31, 1);
	};
	var parseFloat32 = function(value) {
		return parseFloatFromBits(value, 23, 8);
	};
	var parseFloat64 = function(value) {
		return parseFloatFromBits(value, 52, 11);
	};
	var parseNumeric = function(value) {
		var sign = parseBits(value, 16, 32);
		if (sign == 49152) return NaN;
		var weight = Math.pow(1e4, parseBits(value, 16, 16));
		var result = 0;
		var ndigits = parseBits(value, 16);
		for (var i = 0; i < ndigits; i++) {
			result += parseBits(value, 16, 64 + 16 * i) * weight;
			weight /= 1e4;
		}
		var scale = Math.pow(10, parseBits(value, 16, 48));
		return (sign === 0 ? 1 : -1) * Math.round(result * scale) / scale;
	};
	var parseDate = function(isUTC, value) {
		var sign = parseBits(value, 1);
		var rawValue = parseBits(value, 63, 1);
		var result = /* @__PURE__ */ new Date((sign === 0 ? 1 : -1) * rawValue / 1e3 + 9466848e5);
		if (!isUTC) result.setTime(result.getTime() + result.getTimezoneOffset() * 6e4);
		result.usec = rawValue % 1e3;
		result.getMicroSeconds = function() {
			return this.usec;
		};
		result.setMicroSeconds = function(value$1) {
			this.usec = value$1;
		};
		result.getUTCMicroSeconds = function() {
			return this.usec;
		};
		return result;
	};
	var parseArray = function(value) {
		var dim = parseBits(value, 32);
		parseBits(value, 32, 32);
		var elementType = parseBits(value, 32, 64);
		var offset = 96;
		var dims = [];
		for (var i = 0; i < dim; i++) {
			dims[i] = parseBits(value, 32, offset);
			offset += 32;
			offset += 32;
		}
		var parseElement = function(elementType$1) {
			var length = parseBits(value, 32, offset);
			offset += 32;
			if (length == 4294967295) return null;
			var result;
			if (elementType$1 == 23 || elementType$1 == 20) {
				result = parseBits(value, length * 8, offset);
				offset += length * 8;
				return result;
			} else if (elementType$1 == 25) {
				result = value.toString(this.encoding, offset >> 3, (offset += length << 3) >> 3);
				return result;
			} else console.log("ERROR: ElementType not implemented: " + elementType$1);
		};
		var parse$6 = function(dimension, elementType$1) {
			var array$2 = [];
			var i$1;
			if (dimension.length > 1) {
				var count = dimension.shift();
				for (i$1 = 0; i$1 < count; i$1++) array$2[i$1] = parse$6(dimension, elementType$1);
				dimension.unshift(count);
			} else for (i$1 = 0; i$1 < dimension[0]; i$1++) array$2[i$1] = parseElement(elementType$1);
			return array$2;
		};
		return parse$6(dims, elementType);
	};
	var parseText = function(value) {
		return value.toString("utf8");
	};
	var parseBool = function(value) {
		if (value === null) return null;
		return parseBits(value, 8) > 0;
	};
	var init = function(register) {
		register(20, parseInt64);
		register(21, parseInt16);
		register(23, parseInt32);
		register(26, parseInt32);
		register(1700, parseNumeric);
		register(700, parseFloat32);
		register(701, parseFloat64);
		register(16, parseBool);
		register(1114, parseDate.bind(null, false));
		register(1184, parseDate.bind(null, true));
		register(1e3, parseArray);
		register(1007, parseArray);
		register(1016, parseArray);
		register(1008, parseArray);
		register(1009, parseArray);
		register(25, parseText);
	};
	module.exports = { init };
}));

//#endregion
//#region ../../node_modules/.bun/pg-types@2.2.0/node_modules/pg-types/lib/builtins.js
var require_builtins = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* Following query was used to generate this file:
	
	SELECT json_object_agg(UPPER(PT.typname), PT.oid::int4 ORDER BY pt.oid)
	FROM pg_type PT
	WHERE typnamespace = (SELECT pgn.oid FROM pg_namespace pgn WHERE nspname = 'pg_catalog') -- Take only builting Postgres types with stable OID (extension types are not guaranted to be stable)
	AND typtype = 'b' -- Only basic types
	AND typelem = 0 -- Ignore aliases
	AND typisdefined -- Ignore undefined types
	*/
	module.exports = {
		BOOL: 16,
		BYTEA: 17,
		CHAR: 18,
		INT8: 20,
		INT2: 21,
		INT4: 23,
		REGPROC: 24,
		TEXT: 25,
		OID: 26,
		TID: 27,
		XID: 28,
		CID: 29,
		JSON: 114,
		XML: 142,
		PG_NODE_TREE: 194,
		SMGR: 210,
		PATH: 602,
		POLYGON: 604,
		CIDR: 650,
		FLOAT4: 700,
		FLOAT8: 701,
		ABSTIME: 702,
		RELTIME: 703,
		TINTERVAL: 704,
		CIRCLE: 718,
		MACADDR8: 774,
		MONEY: 790,
		MACADDR: 829,
		INET: 869,
		ACLITEM: 1033,
		BPCHAR: 1042,
		VARCHAR: 1043,
		DATE: 1082,
		TIME: 1083,
		TIMESTAMP: 1114,
		TIMESTAMPTZ: 1184,
		INTERVAL: 1186,
		TIMETZ: 1266,
		BIT: 1560,
		VARBIT: 1562,
		NUMERIC: 1700,
		REFCURSOR: 1790,
		REGPROCEDURE: 2202,
		REGOPER: 2203,
		REGOPERATOR: 2204,
		REGCLASS: 2205,
		REGTYPE: 2206,
		UUID: 2950,
		TXID_SNAPSHOT: 2970,
		PG_LSN: 3220,
		PG_NDISTINCT: 3361,
		PG_DEPENDENCIES: 3402,
		TSVECTOR: 3614,
		TSQUERY: 3615,
		GTSVECTOR: 3642,
		REGCONFIG: 3734,
		REGDICTIONARY: 3769,
		JSONB: 3802,
		REGNAMESPACE: 4089,
		REGROLE: 4096
	};
}));

//#endregion
//#region ../../node_modules/.bun/pg-types@2.2.0/node_modules/pg-types/index.js
var require_pg_types = /* @__PURE__ */ __commonJSMin(((exports) => {
	var textParsers = require_textParsers();
	var binaryParsers = require_binaryParsers();
	var arrayParser = require_arrayParser();
	var builtinTypes = require_builtins();
	exports.getTypeParser = getTypeParser;
	exports.setTypeParser = setTypeParser;
	exports.arrayParser = arrayParser;
	exports.builtins = builtinTypes;
	var typeParsers = {
		text: {},
		binary: {}
	};
	function noParse(val$1) {
		return String(val$1);
	}
	function getTypeParser(oid, format) {
		format = format || "text";
		if (!typeParsers[format]) return noParse;
		return typeParsers[format][oid] || noParse;
	}
	function setTypeParser(oid, format, parseFn) {
		if (typeof format == "function") {
			parseFn = format;
			format = "text";
		}
		typeParsers[format][oid] = parseFn;
	}
	textParsers.init(function(oid, converter) {
		typeParsers.text[oid] = converter;
	});
	binaryParsers.init(function(oid, converter) {
		typeParsers.binary[oid] = converter;
	});
}));

//#endregion
//#region ../../node_modules/.bun/pg@8.20.0+52bd52a0bccfa6a2/node_modules/pg/lib/defaults.js
var require_defaults = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	let user$1;
	try {
		user$1 = process.platform === "win32" ? process.env.USERNAME : process.env.USER;
	} catch {}
	module.exports = {
		host: "localhost",
		user: user$1,
		database: void 0,
		password: null,
		connectionString: void 0,
		port: 5432,
		rows: 0,
		binary: false,
		max: 10,
		idleTimeoutMillis: 3e4,
		client_encoding: "",
		ssl: false,
		application_name: void 0,
		fallback_application_name: void 0,
		options: void 0,
		parseInputDatesAsUTC: false,
		statement_timeout: false,
		lock_timeout: false,
		idle_in_transaction_session_timeout: false,
		query_timeout: false,
		connect_timeout: 0,
		keepalives: 1,
		keepalives_idle: 0
	};
	const pgTypes = require_pg_types();
	const parseBigInteger = pgTypes.getTypeParser(20, "text");
	const parseBigIntegerArray = pgTypes.getTypeParser(1016, "text");
	module.exports.__defineSetter__("parseInt8", function(val$1) {
		pgTypes.setTypeParser(20, "text", val$1 ? pgTypes.getTypeParser(23, "text") : parseBigInteger);
		pgTypes.setTypeParser(1016, "text", val$1 ? pgTypes.getTypeParser(1007, "text") : parseBigIntegerArray);
	});
}));

//#endregion
//#region ../../node_modules/.bun/pg@8.20.0+52bd52a0bccfa6a2/node_modules/pg/lib/utils.js
var require_utils$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const defaults$4 = require_defaults();
	const util$3 = __require("util");
	const { isDate } = util$3.types || util$3;
	function escapeElement(elementRepresentation) {
		return "\"" + elementRepresentation.replace(/\\/g, "\\\\").replace(/"/g, "\\\"") + "\"";
	}
	function arrayString(val$1) {
		let result = "{";
		for (let i = 0; i < val$1.length; i++) {
			if (i > 0) result = result + ",";
			if (val$1[i] === null || typeof val$1[i] === "undefined") result = result + "NULL";
			else if (Array.isArray(val$1[i])) result = result + arrayString(val$1[i]);
			else if (ArrayBuffer.isView(val$1[i])) {
				let item = val$1[i];
				if (!(item instanceof Buffer)) {
					const buf = Buffer.from(item.buffer, item.byteOffset, item.byteLength);
					if (buf.length === item.byteLength) item = buf;
					else item = buf.slice(item.byteOffset, item.byteOffset + item.byteLength);
				}
				result += "\\\\x" + item.toString("hex");
			} else result += escapeElement(prepareValue(val$1[i]));
		}
		result = result + "}";
		return result;
	}
	const prepareValue = function(val$1, seen) {
		if (val$1 == null) return null;
		if (typeof val$1 === "object") {
			if (val$1 instanceof Buffer) return val$1;
			if (ArrayBuffer.isView(val$1)) {
				const buf = Buffer.from(val$1.buffer, val$1.byteOffset, val$1.byteLength);
				if (buf.length === val$1.byteLength) return buf;
				return buf.slice(val$1.byteOffset, val$1.byteOffset + val$1.byteLength);
			}
			if (isDate(val$1)) if (defaults$4.parseInputDatesAsUTC) return dateToStringUTC(val$1);
			else return dateToString(val$1);
			if (Array.isArray(val$1)) return arrayString(val$1);
			return prepareObject(val$1, seen);
		}
		return val$1.toString();
	};
	function prepareObject(val$1, seen) {
		if (val$1 && typeof val$1.toPostgres === "function") {
			seen = seen || [];
			if (seen.indexOf(val$1) !== -1) throw new Error("circular reference detected while preparing \"" + val$1 + "\" for query");
			seen.push(val$1);
			return prepareValue(val$1.toPostgres(prepareValue), seen);
		}
		return JSON.stringify(val$1);
	}
	function dateToString(date$1) {
		let offset = -date$1.getTimezoneOffset();
		let year = date$1.getFullYear();
		const isBCYear = year < 1;
		if (isBCYear) year = Math.abs(year) + 1;
		let ret = String(year).padStart(4, "0") + "-" + String(date$1.getMonth() + 1).padStart(2, "0") + "-" + String(date$1.getDate()).padStart(2, "0") + "T" + String(date$1.getHours()).padStart(2, "0") + ":" + String(date$1.getMinutes()).padStart(2, "0") + ":" + String(date$1.getSeconds()).padStart(2, "0") + "." + String(date$1.getMilliseconds()).padStart(3, "0");
		if (offset < 0) {
			ret += "-";
			offset *= -1;
		} else ret += "+";
		ret += String(Math.floor(offset / 60)).padStart(2, "0") + ":" + String(offset % 60).padStart(2, "0");
		if (isBCYear) ret += " BC";
		return ret;
	}
	function dateToStringUTC(date$1) {
		let year = date$1.getUTCFullYear();
		const isBCYear = year < 1;
		if (isBCYear) year = Math.abs(year) + 1;
		let ret = String(year).padStart(4, "0") + "-" + String(date$1.getUTCMonth() + 1).padStart(2, "0") + "-" + String(date$1.getUTCDate()).padStart(2, "0") + "T" + String(date$1.getUTCHours()).padStart(2, "0") + ":" + String(date$1.getUTCMinutes()).padStart(2, "0") + ":" + String(date$1.getUTCSeconds()).padStart(2, "0") + "." + String(date$1.getUTCMilliseconds()).padStart(3, "0");
		ret += "+00:00";
		if (isBCYear) ret += " BC";
		return ret;
	}
	function normalizeQueryConfig(config, values, callback) {
		config = typeof config === "string" ? { text: config } : config;
		if (values) if (typeof values === "function") config.callback = values;
		else config.values = values;
		if (callback) config.callback = callback;
		return config;
	}
	const escapeIdentifier$2 = function(str) {
		return "\"" + str.replace(/"/g, "\"\"") + "\"";
	};
	const escapeLiteral$2 = function(str) {
		let hasBackslash = false;
		let escaped = "'";
		if (str == null) return "''";
		if (typeof str !== "string") return "''";
		for (let i = 0; i < str.length; i++) {
			const c = str[i];
			if (c === "'") escaped += c + c;
			else if (c === "\\") {
				escaped += c + c;
				hasBackslash = true;
			} else escaped += c;
		}
		escaped += "'";
		if (hasBackslash === true) escaped = " E" + escaped;
		return escaped;
	};
	module.exports = {
		prepareValue: function prepareValueWrapper(value) {
			return prepareValue(value);
		},
		normalizeQueryConfig,
		escapeIdentifier: escapeIdentifier$2,
		escapeLiteral: escapeLiteral$2
	};
}));

//#endregion
//#region ../../node_modules/.bun/pg@8.20.0+52bd52a0bccfa6a2/node_modules/pg/lib/crypto/utils-legacy.js
var require_utils_legacy = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const nodeCrypto$1 = __require("crypto");
	function md5$1(string) {
		return nodeCrypto$1.createHash("md5").update(string, "utf-8").digest("hex");
	}
	function postgresMd5PasswordHash$1(user$2, password$1, salt) {
		const inner = md5$1(password$1 + user$2);
		return "md5" + md5$1(Buffer.concat([Buffer.from(inner), salt]));
	}
	function sha256$1(text$1) {
		return nodeCrypto$1.createHash("sha256").update(text$1).digest();
	}
	function hashByName$1(hashName, text$1) {
		hashName = hashName.replace(/(\D)-/, "$1");
		return nodeCrypto$1.createHash(hashName).update(text$1).digest();
	}
	function hmacSha256$1(key, msg) {
		return nodeCrypto$1.createHmac("sha256", key).update(msg).digest();
	}
	async function deriveKey$1(password$1, salt, iterations) {
		return nodeCrypto$1.pbkdf2Sync(password$1, salt, iterations, 32, "sha256");
	}
	module.exports = {
		postgresMd5PasswordHash: postgresMd5PasswordHash$1,
		randomBytes: nodeCrypto$1.randomBytes,
		deriveKey: deriveKey$1,
		sha256: sha256$1,
		hashByName: hashByName$1,
		hmacSha256: hmacSha256$1,
		md5: md5$1
	};
}));

//#endregion
//#region ../../node_modules/.bun/pg@8.20.0+52bd52a0bccfa6a2/node_modules/pg/lib/crypto/utils-webcrypto.js
var require_utils_webcrypto = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const nodeCrypto = __require("crypto");
	module.exports = {
		postgresMd5PasswordHash,
		randomBytes,
		deriveKey,
		sha256,
		hashByName,
		hmacSha256,
		md5
	};
	/**
	* The Web Crypto API - grabbed from the Node.js library or the global
	* @type Crypto
	*/
	const webCrypto = nodeCrypto.webcrypto || globalThis.crypto;
	/**
	* The SubtleCrypto API for low level crypto operations.
	* @type SubtleCrypto
	*/
	const subtleCrypto = webCrypto.subtle;
	const textEncoder = new TextEncoder();
	/**
	*
	* @param {*} length
	* @returns
	*/
	function randomBytes(length) {
		return webCrypto.getRandomValues(Buffer.alloc(length));
	}
	async function md5(string) {
		try {
			return nodeCrypto.createHash("md5").update(string, "utf-8").digest("hex");
		} catch (e) {
			const data = typeof string === "string" ? textEncoder.encode(string) : string;
			const hash = await subtleCrypto.digest("MD5", data);
			return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
		}
	}
	async function postgresMd5PasswordHash(user$2, password$1, salt) {
		const inner = await md5(password$1 + user$2);
		return "md5" + await md5(Buffer.concat([Buffer.from(inner), salt]));
	}
	/**
	* Create a SHA-256 digest of the given data
	* @param {Buffer} data
	*/
	async function sha256(text$1) {
		return await subtleCrypto.digest("SHA-256", text$1);
	}
	async function hashByName(hashName, text$1) {
		return await subtleCrypto.digest(hashName, text$1);
	}
	/**
	* Sign the message with the given key
	* @param {ArrayBuffer} keyBuffer
	* @param {string} msg
	*/
	async function hmacSha256(keyBuffer, msg) {
		const key = await subtleCrypto.importKey("raw", keyBuffer, {
			name: "HMAC",
			hash: "SHA-256"
		}, false, ["sign"]);
		return await subtleCrypto.sign("HMAC", key, textEncoder.encode(msg));
	}
	/**
	* Derive a key from the password and salt
	* @param {string} password
	* @param {Uint8Array} salt
	* @param {number} iterations
	*/
	async function deriveKey(password$1, salt, iterations) {
		const key = await subtleCrypto.importKey("raw", textEncoder.encode(password$1), "PBKDF2", false, ["deriveBits"]);
		const params = {
			name: "PBKDF2",
			hash: "SHA-256",
			salt,
			iterations
		};
		return await subtleCrypto.deriveBits(params, key, 256, ["deriveBits"]);
	}
}));

//#endregion
//#region ../../node_modules/.bun/pg@8.20.0+52bd52a0bccfa6a2/node_modules/pg/lib/crypto/utils.js
var require_utils = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	if (parseInt(process.versions && process.versions.node && process.versions.node.split(".")[0]) < 15) module.exports = require_utils_legacy();
	else module.exports = require_utils_webcrypto();
}));

//#endregion
//#region ../../node_modules/.bun/pg@8.20.0+52bd52a0bccfa6a2/node_modules/pg/lib/crypto/cert-signatures.js
var require_cert_signatures = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	function x509Error(msg, cert) {
		return /* @__PURE__ */ new Error("SASL channel binding: " + msg + " when parsing public certificate " + cert.toString("base64"));
	}
	function readASN1Length(data, index$1) {
		let length = data[index$1++];
		if (length < 128) return {
			length,
			index: index$1
		};
		const lengthBytes = length & 127;
		if (lengthBytes > 4) throw x509Error("bad length", data);
		length = 0;
		for (let i = 0; i < lengthBytes; i++) length = length << 8 | data[index$1++];
		return {
			length,
			index: index$1
		};
	}
	function readASN1OID(data, index$1) {
		if (data[index$1++] !== 6) throw x509Error("non-OID data", data);
		const { length: OIDLength, index: indexAfterOIDLength } = readASN1Length(data, index$1);
		index$1 = indexAfterOIDLength;
		const lastIndex = index$1 + OIDLength;
		const byte1 = data[index$1++];
		let oid = (byte1 / 40 >> 0) + "." + byte1 % 40;
		while (index$1 < lastIndex) {
			let value = 0;
			while (index$1 < lastIndex) {
				const nextByte = data[index$1++];
				value = value << 7 | nextByte & 127;
				if (nextByte < 128) break;
			}
			oid += "." + value;
		}
		return {
			oid,
			index: index$1
		};
	}
	function expectASN1Seq(data, index$1) {
		if (data[index$1++] !== 48) throw x509Error("non-sequence data", data);
		return readASN1Length(data, index$1);
	}
	function signatureAlgorithmHashFromCertificate$1(data, index$1) {
		if (index$1 === void 0) index$1 = 0;
		index$1 = expectASN1Seq(data, index$1).index;
		const { length: certInfoLength, index: indexAfterCertInfoLength } = expectASN1Seq(data, index$1);
		index$1 = indexAfterCertInfoLength + certInfoLength;
		index$1 = expectASN1Seq(data, index$1).index;
		const { oid, index: indexAfterOID } = readASN1OID(data, index$1);
		switch (oid) {
			case "1.2.840.113549.1.1.4": return "MD5";
			case "1.2.840.113549.1.1.5": return "SHA-1";
			case "1.2.840.113549.1.1.11": return "SHA-256";
			case "1.2.840.113549.1.1.12": return "SHA-384";
			case "1.2.840.113549.1.1.13": return "SHA-512";
			case "1.2.840.113549.1.1.14": return "SHA-224";
			case "1.2.840.113549.1.1.15": return "SHA512-224";
			case "1.2.840.113549.1.1.16": return "SHA512-256";
			case "1.2.840.10045.4.1": return "SHA-1";
			case "1.2.840.10045.4.3.1": return "SHA-224";
			case "1.2.840.10045.4.3.2": return "SHA-256";
			case "1.2.840.10045.4.3.3": return "SHA-384";
			case "1.2.840.10045.4.3.4": return "SHA-512";
			case "1.2.840.113549.1.1.10": {
				index$1 = indexAfterOID;
				index$1 = expectASN1Seq(data, index$1).index;
				if (data[index$1++] !== 160) throw x509Error("non-tag data", data);
				index$1 = readASN1Length(data, index$1).index;
				index$1 = expectASN1Seq(data, index$1).index;
				const { oid: hashOID } = readASN1OID(data, index$1);
				switch (hashOID) {
					case "1.2.840.113549.2.5": return "MD5";
					case "1.3.14.3.2.26": return "SHA-1";
					case "2.16.840.1.101.3.4.2.1": return "SHA-256";
					case "2.16.840.1.101.3.4.2.2": return "SHA-384";
					case "2.16.840.1.101.3.4.2.3": return "SHA-512";
				}
				throw x509Error("unknown hash OID " + hashOID, data);
			}
			case "1.3.101.110":
			case "1.3.101.112": return "SHA-512";
			case "1.3.101.111":
			case "1.3.101.113": throw x509Error("Ed448 certificate channel binding is not currently supported by Postgres");
		}
		throw x509Error("unknown OID " + oid, data);
	}
	module.exports = { signatureAlgorithmHashFromCertificate: signatureAlgorithmHashFromCertificate$1 };
}));

//#endregion
//#region ../../node_modules/.bun/pg@8.20.0+52bd52a0bccfa6a2/node_modules/pg/lib/crypto/sasl.js
var require_sasl = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const crypto$2 = require_utils();
	const { signatureAlgorithmHashFromCertificate } = require_cert_signatures();
	function startSession(mechanisms, stream) {
		const candidates = ["SCRAM-SHA-256"];
		if (stream) candidates.unshift("SCRAM-SHA-256-PLUS");
		const mechanism = candidates.find((candidate) => mechanisms.includes(candidate));
		if (!mechanism) throw new Error("SASL: Only mechanism(s) " + candidates.join(" and ") + " are supported");
		if (mechanism === "SCRAM-SHA-256-PLUS" && typeof stream.getPeerCertificate !== "function") throw new Error("SASL: Mechanism SCRAM-SHA-256-PLUS requires a certificate");
		const clientNonce = crypto$2.randomBytes(18).toString("base64");
		return {
			mechanism,
			clientNonce,
			response: (mechanism === "SCRAM-SHA-256-PLUS" ? "p=tls-server-end-point" : stream ? "y" : "n") + ",,n=*,r=" + clientNonce,
			message: "SASLInitialResponse"
		};
	}
	async function continueSession(session$1, password$1, serverData, stream) {
		if (session$1.message !== "SASLInitialResponse") throw new Error("SASL: Last message was not SASLInitialResponse");
		if (typeof password$1 !== "string") throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string");
		if (password$1 === "") throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a non-empty string");
		if (typeof serverData !== "string") throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: serverData must be a string");
		const sv = parseServerFirstMessage(serverData);
		if (!sv.nonce.startsWith(session$1.clientNonce)) throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: server nonce does not start with client nonce");
		else if (sv.nonce.length === session$1.clientNonce.length) throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: server nonce is too short");
		const clientFirstMessageBare = "n=*,r=" + session$1.clientNonce;
		const serverFirstMessage = "r=" + sv.nonce + ",s=" + sv.salt + ",i=" + sv.iteration;
		let channelBinding = stream ? "eSws" : "biws";
		if (session$1.mechanism === "SCRAM-SHA-256-PLUS") {
			const peerCert = stream.getPeerCertificate().raw;
			let hashName = signatureAlgorithmHashFromCertificate(peerCert);
			if (hashName === "MD5" || hashName === "SHA-1") hashName = "SHA-256";
			const certHash = await crypto$2.hashByName(hashName, peerCert);
			channelBinding = Buffer.concat([Buffer.from("p=tls-server-end-point,,"), Buffer.from(certHash)]).toString("base64");
		}
		const clientFinalMessageWithoutProof = "c=" + channelBinding + ",r=" + sv.nonce;
		const authMessage = clientFirstMessageBare + "," + serverFirstMessage + "," + clientFinalMessageWithoutProof;
		const saltBytes = Buffer.from(sv.salt, "base64");
		const saltedPassword = await crypto$2.deriveKey(password$1, saltBytes, sv.iteration);
		const clientKey = await crypto$2.hmacSha256(saltedPassword, "Client Key");
		const storedKey = await crypto$2.sha256(clientKey);
		const clientSignature = await crypto$2.hmacSha256(storedKey, authMessage);
		const clientProof = xorBuffers(Buffer.from(clientKey), Buffer.from(clientSignature)).toString("base64");
		const serverKey = await crypto$2.hmacSha256(saltedPassword, "Server Key");
		const serverSignatureBytes = await crypto$2.hmacSha256(serverKey, authMessage);
		session$1.message = "SASLResponse";
		session$1.serverSignature = Buffer.from(serverSignatureBytes).toString("base64");
		session$1.response = clientFinalMessageWithoutProof + ",p=" + clientProof;
	}
	function finalizeSession(session$1, serverData) {
		if (session$1.message !== "SASLResponse") throw new Error("SASL: Last message was not SASLResponse");
		if (typeof serverData !== "string") throw new Error("SASL: SCRAM-SERVER-FINAL-MESSAGE: serverData must be a string");
		const { serverSignature } = parseServerFinalMessage(serverData);
		if (serverSignature !== session$1.serverSignature) throw new Error("SASL: SCRAM-SERVER-FINAL-MESSAGE: server signature does not match");
	}
	/**
	* printable       = %x21-2B / %x2D-7E
	*                   ;; Printable ASCII except ",".
	*                   ;; Note that any "printable" is also
	*                   ;; a valid "value".
	*/
	function isPrintableChars(text$1) {
		if (typeof text$1 !== "string") throw new TypeError("SASL: text must be a string");
		return text$1.split("").map((_, i) => text$1.charCodeAt(i)).every((c) => c >= 33 && c <= 43 || c >= 45 && c <= 126);
	}
	/**
	* base64-char     = ALPHA / DIGIT / "/" / "+"
	*
	* base64-4        = 4base64-char
	*
	* base64-3        = 3base64-char "="
	*
	* base64-2        = 2base64-char "=="
	*
	* base64          = *base64-4 [base64-3 / base64-2]
	*/
	function isBase64(text$1) {
		return /^(?:[a-zA-Z0-9+/]{4})*(?:[a-zA-Z0-9+/]{2}==|[a-zA-Z0-9+/]{3}=)?$/.test(text$1);
	}
	function parseAttributePairs(text$1) {
		if (typeof text$1 !== "string") throw new TypeError("SASL: attribute pairs text must be a string");
		return new Map(text$1.split(",").map((attrValue) => {
			if (!/^.=/.test(attrValue)) throw new Error("SASL: Invalid attribute pair entry");
			return [attrValue[0], attrValue.substring(2)];
		}));
	}
	function parseServerFirstMessage(data) {
		const attrPairs = parseAttributePairs(data);
		const nonce = attrPairs.get("r");
		if (!nonce) throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: nonce missing");
		else if (!isPrintableChars(nonce)) throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: nonce must only contain printable characters");
		const salt = attrPairs.get("s");
		if (!salt) throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: salt missing");
		else if (!isBase64(salt)) throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: salt must be base64");
		const iterationText = attrPairs.get("i");
		if (!iterationText) throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: iteration missing");
		else if (!/^[1-9][0-9]*$/.test(iterationText)) throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: invalid iteration count");
		return {
			nonce,
			salt,
			iteration: parseInt(iterationText, 10)
		};
	}
	function parseServerFinalMessage(serverData) {
		const serverSignature = parseAttributePairs(serverData).get("v");
		if (!serverSignature) throw new Error("SASL: SCRAM-SERVER-FINAL-MESSAGE: server signature is missing");
		else if (!isBase64(serverSignature)) throw new Error("SASL: SCRAM-SERVER-FINAL-MESSAGE: server signature must be base64");
		return { serverSignature };
	}
	function xorBuffers(a, b) {
		if (!Buffer.isBuffer(a)) throw new TypeError("first argument must be a Buffer");
		if (!Buffer.isBuffer(b)) throw new TypeError("second argument must be a Buffer");
		if (a.length !== b.length) throw new Error("Buffer lengths must match");
		if (a.length === 0) throw new Error("Buffers cannot be empty");
		return Buffer.from(a.map((_, i) => a[i] ^ b[i]));
	}
	module.exports = {
		startSession,
		continueSession,
		finalizeSession
	};
}));

//#endregion
//#region ../../node_modules/.bun/pg@8.20.0+52bd52a0bccfa6a2/node_modules/pg/lib/type-overrides.js
var require_type_overrides = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const types$3 = require_pg_types();
	function TypeOverrides$4(userTypes) {
		this._types = userTypes || types$3;
		this.text = {};
		this.binary = {};
	}
	TypeOverrides$4.prototype.getOverrides = function(format) {
		switch (format) {
			case "text": return this.text;
			case "binary": return this.binary;
			default: return {};
		}
	};
	TypeOverrides$4.prototype.setTypeParser = function(oid, format, parseFn) {
		if (typeof format === "function") {
			parseFn = format;
			format = "text";
		}
		this.getOverrides(format)[oid] = parseFn;
	};
	TypeOverrides$4.prototype.getTypeParser = function(oid, format) {
		format = format || "text";
		return this.getOverrides(format)[oid] || this._types.getTypeParser(oid, format);
	};
	module.exports = TypeOverrides$4;
}));

//#endregion
//#region ../../node_modules/.bun/pg-connection-string@2.12.0/node_modules/pg-connection-string/index.js
var require_pg_connection_string = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	function parse$4(str, options = {}) {
		if (str.charAt(0) === "/") {
			const config$1 = str.split(" ");
			return {
				host: config$1[0],
				database: config$1[1]
			};
		}
		const config = {};
		let result;
		let dummyHost = false;
		if (/ |%[^a-f0-9]|%[a-f0-9][^a-f0-9]/i.test(str)) str = encodeURI(str).replace(/%25(\d\d)/g, "%$1");
		try {
			try {
				result = new URL(str, "postgres://base");
			} catch (e) {
				result = new URL(str.replace("@/", "@___DUMMY___/"), "postgres://base");
				dummyHost = true;
			}
		} catch (err) {
			err.input && (err.input = "*****REDACTED*****");
			throw err;
		}
		for (const entry of result.searchParams.entries()) config[entry[0]] = entry[1];
		config.user = config.user || decodeURIComponent(result.username);
		config.password = config.password || decodeURIComponent(result.password);
		if (result.protocol == "socket:") {
			config.host = decodeURI(result.pathname);
			config.database = result.searchParams.get("db");
			config.client_encoding = result.searchParams.get("encoding");
			return config;
		}
		const hostname = dummyHost ? "" : result.hostname;
		if (!config.host) config.host = decodeURIComponent(hostname);
		else if (hostname && /^%2f/i.test(hostname)) result.pathname = hostname + result.pathname;
		if (!config.port) config.port = result.port;
		const pathname = result.pathname.slice(1) || null;
		config.database = pathname ? decodeURI(pathname) : null;
		if (config.ssl === "true" || config.ssl === "1") config.ssl = true;
		if (config.ssl === "0") config.ssl = false;
		if (config.sslcert || config.sslkey || config.sslrootcert || config.sslmode) config.ssl = {};
		const fs$1 = config.sslcert || config.sslkey || config.sslrootcert ? __require("fs") : null;
		if (config.sslcert) config.ssl.cert = fs$1.readFileSync(config.sslcert).toString();
		if (config.sslkey) config.ssl.key = fs$1.readFileSync(config.sslkey).toString();
		if (config.sslrootcert) config.ssl.ca = fs$1.readFileSync(config.sslrootcert).toString();
		if (options.useLibpqCompat && config.uselibpqcompat) throw new Error("Both useLibpqCompat and uselibpqcompat are set. Please use only one of them.");
		if (config.uselibpqcompat === "true" || options.useLibpqCompat) switch (config.sslmode) {
			case "disable":
				config.ssl = false;
				break;
			case "prefer":
				config.ssl.rejectUnauthorized = false;
				break;
			case "require":
				if (config.sslrootcert) config.ssl.checkServerIdentity = function() {};
				else config.ssl.rejectUnauthorized = false;
				break;
			case "verify-ca":
				if (!config.ssl.ca) throw new Error("SECURITY WARNING: Using sslmode=verify-ca requires specifying a CA with sslrootcert. If a public CA is used, verify-ca allows connections to a server that somebody else may have registered with the CA, making you vulnerable to Man-in-the-Middle attacks. Either specify a custom CA certificate with sslrootcert parameter or use sslmode=verify-full for proper security.");
				config.ssl.checkServerIdentity = function() {};
				break;
			case "verify-full": break;
		}
		else switch (config.sslmode) {
			case "disable":
				config.ssl = false;
				break;
			case "prefer":
			case "require":
			case "verify-ca":
			case "verify-full":
				if (config.sslmode !== "verify-full") deprecatedSslModeWarning(config.sslmode);
				break;
			case "no-verify":
				config.ssl.rejectUnauthorized = false;
				break;
		}
		return config;
	}
	function toConnectionOptions(sslConfig) {
		return Object.entries(sslConfig).reduce((c, [key, value]) => {
			if (value !== void 0 && value !== null) c[key] = value;
			return c;
		}, {});
	}
	function toClientConfig(config) {
		return Object.entries(config).reduce((c, [key, value]) => {
			if (key === "ssl") {
				const sslConfig = value;
				if (typeof sslConfig === "boolean") c[key] = sslConfig;
				if (typeof sslConfig === "object") c[key] = toConnectionOptions(sslConfig);
			} else if (value !== void 0 && value !== null) if (key === "port") {
				if (value !== "") {
					const v = parseInt(value, 10);
					if (isNaN(v)) throw new Error(`Invalid ${key}: ${value}`);
					c[key] = v;
				}
			} else c[key] = value;
			return c;
		}, {});
	}
	function parseIntoClientConfig(str) {
		return toClientConfig(parse$4(str));
	}
	function deprecatedSslModeWarning(sslmode) {
		if (!deprecatedSslModeWarning.warned && typeof process !== "undefined" && process.emitWarning) {
			deprecatedSslModeWarning.warned = true;
			process.emitWarning(`SECURITY WARNING: The SSL modes 'prefer', 'require', and 'verify-ca' are treated as aliases for 'verify-full'.
In the next major version (pg-connection-string v3.0.0 and pg v9.0.0), these modes will adopt standard libpq semantics, which have weaker security guarantees.

To prepare for this change:
- If you want the current behavior, explicitly use 'sslmode=verify-full'
- If you want libpq compatibility now, use 'uselibpqcompat=true&sslmode=${sslmode}'

See https://www.postgresql.org/docs/current/libpq-ssl.html for libpq SSL mode definitions.`);
		}
	}
	module.exports = parse$4;
	parse$4.parse = parse$4;
	parse$4.toClientConfig = toClientConfig;
	parse$4.parseIntoClientConfig = parseIntoClientConfig;
}));

//#endregion
//#region ../../node_modules/.bun/pg@8.20.0+52bd52a0bccfa6a2/node_modules/pg/lib/connection-parameters.js
var require_connection_parameters = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const dns = __require("dns");
	const defaults$3 = require_defaults();
	const parse$3 = require_pg_connection_string().parse;
	const val = function(key, config, envVar) {
		if (config[key]) return config[key];
		if (envVar === void 0) envVar = process.env["PG" + key.toUpperCase()];
		else if (envVar === false) {} else envVar = process.env[envVar];
		return envVar || defaults$3[key];
	};
	const readSSLConfigFromEnvironment = function() {
		switch (process.env.PGSSLMODE) {
			case "disable": return false;
			case "prefer":
			case "require":
			case "verify-ca":
			case "verify-full": return true;
			case "no-verify": return { rejectUnauthorized: false };
		}
		return defaults$3.ssl;
	};
	const quoteParamValue = function(value) {
		return "'" + ("" + value).replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'";
	};
	const add = function(params, config, paramName) {
		const value = config[paramName];
		if (value !== void 0 && value !== null) params.push(paramName + "=" + quoteParamValue(value));
	};
	var ConnectionParameters$2 = class {
		constructor(config) {
			config = typeof config === "string" ? parse$3(config) : config || {};
			if (config.connectionString) config = Object.assign({}, config, parse$3(config.connectionString));
			this.user = val("user", config);
			this.database = val("database", config);
			if (this.database === void 0) this.database = this.user;
			this.port = parseInt(val("port", config), 10);
			this.host = val("host", config);
			Object.defineProperty(this, "password", {
				configurable: true,
				enumerable: false,
				writable: true,
				value: val("password", config)
			});
			this.binary = val("binary", config);
			this.options = val("options", config);
			this.ssl = typeof config.ssl === "undefined" ? readSSLConfigFromEnvironment() : config.ssl;
			if (typeof this.ssl === "string") {
				if (this.ssl === "true") this.ssl = true;
			}
			if (this.ssl === "no-verify") this.ssl = { rejectUnauthorized: false };
			if (this.ssl && this.ssl.key) Object.defineProperty(this.ssl, "key", { enumerable: false });
			this.client_encoding = val("client_encoding", config);
			this.replication = val("replication", config);
			this.isDomainSocket = !(this.host || "").indexOf("/");
			this.application_name = val("application_name", config, "PGAPPNAME");
			this.fallback_application_name = val("fallback_application_name", config, false);
			this.statement_timeout = val("statement_timeout", config, false);
			this.lock_timeout = val("lock_timeout", config, false);
			this.idle_in_transaction_session_timeout = val("idle_in_transaction_session_timeout", config, false);
			this.query_timeout = val("query_timeout", config, false);
			if (config.connectionTimeoutMillis === void 0) this.connect_timeout = process.env.PGCONNECT_TIMEOUT || 0;
			else this.connect_timeout = Math.floor(config.connectionTimeoutMillis / 1e3);
			if (config.keepAlive === false) this.keepalives = 0;
			else if (config.keepAlive === true) this.keepalives = 1;
			if (typeof config.keepAliveInitialDelayMillis === "number") this.keepalives_idle = Math.floor(config.keepAliveInitialDelayMillis / 1e3);
		}
		getLibpqConnectionString(cb) {
			const params = [];
			add(params, this, "user");
			add(params, this, "password");
			add(params, this, "port");
			add(params, this, "application_name");
			add(params, this, "fallback_application_name");
			add(params, this, "connect_timeout");
			add(params, this, "options");
			const ssl = typeof this.ssl === "object" ? this.ssl : this.ssl ? { sslmode: this.ssl } : {};
			add(params, ssl, "sslmode");
			add(params, ssl, "sslca");
			add(params, ssl, "sslkey");
			add(params, ssl, "sslcert");
			add(params, ssl, "sslrootcert");
			if (this.database) params.push("dbname=" + quoteParamValue(this.database));
			if (this.replication) params.push("replication=" + quoteParamValue(this.replication));
			if (this.host) params.push("host=" + quoteParamValue(this.host));
			if (this.isDomainSocket) return cb(null, params.join(" "));
			if (this.client_encoding) params.push("client_encoding=" + quoteParamValue(this.client_encoding));
			dns.lookup(this.host, function(err, address) {
				if (err) return cb(err, null);
				params.push("hostaddr=" + quoteParamValue(address));
				return cb(null, params.join(" "));
			});
		}
	};
	module.exports = ConnectionParameters$2;
}));

//#endregion
//#region ../../node_modules/.bun/pg@8.20.0+52bd52a0bccfa6a2/node_modules/pg/lib/result.js
var require_result = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const types$2 = require_pg_types();
	const matchRegexp = /^([A-Za-z]+)(?: (\d+))?(?: (\d+))?/;
	var Result$3 = class {
		constructor(rowMode, types$4) {
			this.command = null;
			this.rowCount = null;
			this.oid = null;
			this.rows = [];
			this.fields = [];
			this._parsers = void 0;
			this._types = types$4;
			this.RowCtor = null;
			this.rowAsArray = rowMode === "array";
			if (this.rowAsArray) this.parseRow = this._parseRowAsArray;
			this._prebuiltEmptyResultObject = null;
		}
		addCommandComplete(msg) {
			let match;
			if (msg.text) match = matchRegexp.exec(msg.text);
			else match = matchRegexp.exec(msg.command);
			if (match) {
				this.command = match[1];
				if (match[3]) {
					this.oid = parseInt(match[2], 10);
					this.rowCount = parseInt(match[3], 10);
				} else if (match[2]) this.rowCount = parseInt(match[2], 10);
			}
		}
		_parseRowAsArray(rowData) {
			const row = new Array(rowData.length);
			for (let i = 0, len = rowData.length; i < len; i++) {
				const rawValue = rowData[i];
				if (rawValue !== null) row[i] = this._parsers[i](rawValue);
				else row[i] = null;
			}
			return row;
		}
		parseRow(rowData) {
			const row = { ...this._prebuiltEmptyResultObject };
			for (let i = 0, len = rowData.length; i < len; i++) {
				const rawValue = rowData[i];
				const field = this.fields[i].name;
				if (rawValue !== null) {
					const v = this.fields[i].format === "binary" ? Buffer.from(rawValue) : rawValue;
					row[field] = this._parsers[i](v);
				} else row[field] = null;
			}
			return row;
		}
		addRow(row) {
			this.rows.push(row);
		}
		addFields(fieldDescriptions) {
			this.fields = fieldDescriptions;
			if (this.fields.length) this._parsers = new Array(fieldDescriptions.length);
			const row = {};
			for (let i = 0; i < fieldDescriptions.length; i++) {
				const desc$1 = fieldDescriptions[i];
				row[desc$1.name] = null;
				if (this._types) this._parsers[i] = this._types.getTypeParser(desc$1.dataTypeID, desc$1.format || "text");
				else this._parsers[i] = types$2.getTypeParser(desc$1.dataTypeID, desc$1.format || "text");
			}
			this._prebuiltEmptyResultObject = { ...row };
		}
	};
	module.exports = Result$3;
}));

//#endregion
//#region ../../node_modules/.bun/pg@8.20.0+52bd52a0bccfa6a2/node_modules/pg/lib/query.js
var require_query$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const { EventEmitter: EventEmitter$5 } = __require("events");
	const Result$2 = require_result();
	const utils$3 = require_utils$1();
	var Query$2 = class extends EventEmitter$5 {
		constructor(config, values, callback) {
			super();
			config = utils$3.normalizeQueryConfig(config, values, callback);
			this.text = config.text;
			this.values = config.values;
			this.rows = config.rows;
			this.types = config.types;
			this.name = config.name;
			this.queryMode = config.queryMode;
			this.binary = config.binary;
			this.portal = config.portal || "";
			this.callback = config.callback;
			this._rowMode = config.rowMode;
			if (process.domain && config.callback) this.callback = process.domain.bind(config.callback);
			this._result = new Result$2(this._rowMode, this.types);
			this._results = this._result;
			this._canceledDueToError = false;
		}
		requiresPreparation() {
			if (this.queryMode === "extended") return true;
			if (this.name) return true;
			if (this.rows) return true;
			if (!this.text) return false;
			if (!this.values) return false;
			return this.values.length > 0;
		}
		_checkForMultirow() {
			if (this._result.command) {
				if (!Array.isArray(this._results)) this._results = [this._result];
				this._result = new Result$2(this._rowMode, this._result._types);
				this._results.push(this._result);
			}
		}
		handleRowDescription(msg) {
			this._checkForMultirow();
			this._result.addFields(msg.fields);
			this._accumulateRows = this.callback || !this.listeners("row").length;
		}
		handleDataRow(msg) {
			let row;
			if (this._canceledDueToError) return;
			try {
				row = this._result.parseRow(msg.fields);
			} catch (err) {
				this._canceledDueToError = err;
				return;
			}
			this.emit("row", row, this._result);
			if (this._accumulateRows) this._result.addRow(row);
		}
		handleCommandComplete(msg, connection) {
			this._checkForMultirow();
			this._result.addCommandComplete(msg);
			if (this.rows) connection.sync();
		}
		handleEmptyQuery(connection) {
			if (this.rows) connection.sync();
		}
		handleError(err, connection) {
			if (this._canceledDueToError) {
				err = this._canceledDueToError;
				this._canceledDueToError = false;
			}
			if (this.callback) return this.callback(err);
			this.emit("error", err);
		}
		handleReadyForQuery(con) {
			if (this._canceledDueToError) return this.handleError(this._canceledDueToError, con);
			if (this.callback) try {
				this.callback(null, this._results);
			} catch (err) {
				process.nextTick(() => {
					throw err;
				});
			}
			this.emit("end", this._results);
		}
		submit(connection) {
			if (typeof this.text !== "string" && typeof this.name !== "string") return /* @__PURE__ */ new Error("A query must have either text or a name. Supplying neither is unsupported.");
			const previous = connection.parsedStatements[this.name];
			if (this.text && previous && this.text !== previous) return /* @__PURE__ */ new Error(`Prepared statements must be unique - '${this.name}' was used for a different statement`);
			if (this.values && !Array.isArray(this.values)) return /* @__PURE__ */ new Error("Query values must be an array");
			if (this.requiresPreparation()) {
				connection.stream.cork && connection.stream.cork();
				try {
					this.prepare(connection);
				} finally {
					connection.stream.uncork && connection.stream.uncork();
				}
			} else connection.query(this.text);
			return null;
		}
		hasBeenParsed(connection) {
			return this.name && connection.parsedStatements[this.name];
		}
		handlePortalSuspended(connection) {
			this._getRows(connection, this.rows);
		}
		_getRows(connection, rows) {
			connection.execute({
				portal: this.portal,
				rows
			});
			if (!rows) connection.sync();
			else connection.flush();
		}
		prepare(connection) {
			if (!this.hasBeenParsed(connection)) connection.parse({
				text: this.text,
				name: this.name,
				types: this.types
			});
			try {
				connection.bind({
					portal: this.portal,
					statement: this.name,
					values: this.values,
					binary: this.binary,
					valueMapper: utils$3.prepareValue
				});
			} catch (err) {
				this.handleError(err, connection);
				return;
			}
			connection.describe({
				type: "P",
				name: this.portal || ""
			});
			this._getRows(connection, this.rows);
		}
		handleCopyInResponse(connection) {
			connection.sendCopyFail("No source stream defined");
		}
		handleCopyData(msg, connection) {}
	};
	module.exports = Query$2;
}));

//#endregion
//#region ../../node_modules/.bun/pg-protocol@1.13.0/node_modules/pg-protocol/dist/messages.js
var require_messages = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.NoticeMessage = exports.DataRowMessage = exports.CommandCompleteMessage = exports.ReadyForQueryMessage = exports.NotificationResponseMessage = exports.BackendKeyDataMessage = exports.AuthenticationMD5Password = exports.ParameterStatusMessage = exports.ParameterDescriptionMessage = exports.RowDescriptionMessage = exports.Field = exports.CopyResponse = exports.CopyDataMessage = exports.DatabaseError = exports.copyDone = exports.emptyQuery = exports.replicationStart = exports.portalSuspended = exports.noData = exports.closeComplete = exports.bindComplete = exports.parseComplete = void 0;
	exports.parseComplete = {
		name: "parseComplete",
		length: 5
	};
	exports.bindComplete = {
		name: "bindComplete",
		length: 5
	};
	exports.closeComplete = {
		name: "closeComplete",
		length: 5
	};
	exports.noData = {
		name: "noData",
		length: 5
	};
	exports.portalSuspended = {
		name: "portalSuspended",
		length: 5
	};
	exports.replicationStart = {
		name: "replicationStart",
		length: 4
	};
	exports.emptyQuery = {
		name: "emptyQuery",
		length: 4
	};
	exports.copyDone = {
		name: "copyDone",
		length: 4
	};
	var DatabaseError$2 = class extends Error {
		constructor(message, length, name) {
			super(message);
			this.length = length;
			this.name = name;
		}
	};
	exports.DatabaseError = DatabaseError$2;
	var CopyDataMessage = class {
		constructor(length, chunk) {
			this.length = length;
			this.chunk = chunk;
			this.name = "copyData";
		}
	};
	exports.CopyDataMessage = CopyDataMessage;
	var CopyResponse = class {
		constructor(length, name, binary, columnCount) {
			this.length = length;
			this.name = name;
			this.binary = binary;
			this.columnTypes = new Array(columnCount);
		}
	};
	exports.CopyResponse = CopyResponse;
	var Field = class {
		constructor(name, tableID, columnID, dataTypeID, dataTypeSize, dataTypeModifier, format) {
			this.name = name;
			this.tableID = tableID;
			this.columnID = columnID;
			this.dataTypeID = dataTypeID;
			this.dataTypeSize = dataTypeSize;
			this.dataTypeModifier = dataTypeModifier;
			this.format = format;
		}
	};
	exports.Field = Field;
	var RowDescriptionMessage = class {
		constructor(length, fieldCount) {
			this.length = length;
			this.fieldCount = fieldCount;
			this.name = "rowDescription";
			this.fields = new Array(this.fieldCount);
		}
	};
	exports.RowDescriptionMessage = RowDescriptionMessage;
	var ParameterDescriptionMessage = class {
		constructor(length, parameterCount) {
			this.length = length;
			this.parameterCount = parameterCount;
			this.name = "parameterDescription";
			this.dataTypeIDs = new Array(this.parameterCount);
		}
	};
	exports.ParameterDescriptionMessage = ParameterDescriptionMessage;
	var ParameterStatusMessage = class {
		constructor(length, parameterName, parameterValue) {
			this.length = length;
			this.parameterName = parameterName;
			this.parameterValue = parameterValue;
			this.name = "parameterStatus";
		}
	};
	exports.ParameterStatusMessage = ParameterStatusMessage;
	var AuthenticationMD5Password = class {
		constructor(length, salt) {
			this.length = length;
			this.salt = salt;
			this.name = "authenticationMD5Password";
		}
	};
	exports.AuthenticationMD5Password = AuthenticationMD5Password;
	var BackendKeyDataMessage = class {
		constructor(length, processID, secretKey) {
			this.length = length;
			this.processID = processID;
			this.secretKey = secretKey;
			this.name = "backendKeyData";
		}
	};
	exports.BackendKeyDataMessage = BackendKeyDataMessage;
	var NotificationResponseMessage = class {
		constructor(length, processId, channel, payload) {
			this.length = length;
			this.processId = processId;
			this.channel = channel;
			this.payload = payload;
			this.name = "notification";
		}
	};
	exports.NotificationResponseMessage = NotificationResponseMessage;
	var ReadyForQueryMessage = class {
		constructor(length, status) {
			this.length = length;
			this.status = status;
			this.name = "readyForQuery";
		}
	};
	exports.ReadyForQueryMessage = ReadyForQueryMessage;
	var CommandCompleteMessage = class {
		constructor(length, text$1) {
			this.length = length;
			this.text = text$1;
			this.name = "commandComplete";
		}
	};
	exports.CommandCompleteMessage = CommandCompleteMessage;
	var DataRowMessage = class {
		constructor(length, fields) {
			this.length = length;
			this.fields = fields;
			this.name = "dataRow";
			this.fieldCount = fields.length;
		}
	};
	exports.DataRowMessage = DataRowMessage;
	var NoticeMessage = class {
		constructor(length, message) {
			this.length = length;
			this.message = message;
			this.name = "notice";
		}
	};
	exports.NoticeMessage = NoticeMessage;
}));

//#endregion
//#region ../../node_modules/.bun/pg-protocol@1.13.0/node_modules/pg-protocol/dist/buffer-writer.js
var require_buffer_writer = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.Writer = void 0;
	var Writer = class {
		constructor(size = 256) {
			this.size = size;
			this.offset = 5;
			this.headerPosition = 0;
			this.buffer = Buffer.allocUnsafe(size);
		}
		ensure(size) {
			if (this.buffer.length - this.offset < size) {
				const oldBuffer = this.buffer;
				const newSize = oldBuffer.length + (oldBuffer.length >> 1) + size;
				this.buffer = Buffer.allocUnsafe(newSize);
				oldBuffer.copy(this.buffer);
			}
		}
		addInt32(num) {
			this.ensure(4);
			this.buffer[this.offset++] = num >>> 24 & 255;
			this.buffer[this.offset++] = num >>> 16 & 255;
			this.buffer[this.offset++] = num >>> 8 & 255;
			this.buffer[this.offset++] = num >>> 0 & 255;
			return this;
		}
		addInt16(num) {
			this.ensure(2);
			this.buffer[this.offset++] = num >>> 8 & 255;
			this.buffer[this.offset++] = num >>> 0 & 255;
			return this;
		}
		addCString(string) {
			if (!string) this.ensure(1);
			else {
				const len = Buffer.byteLength(string);
				this.ensure(len + 1);
				this.buffer.write(string, this.offset, "utf-8");
				this.offset += len;
			}
			this.buffer[this.offset++] = 0;
			return this;
		}
		addString(string = "") {
			const len = Buffer.byteLength(string);
			this.ensure(len);
			this.buffer.write(string, this.offset);
			this.offset += len;
			return this;
		}
		add(otherBuffer) {
			this.ensure(otherBuffer.length);
			otherBuffer.copy(this.buffer, this.offset);
			this.offset += otherBuffer.length;
			return this;
		}
		join(code) {
			if (code) {
				this.buffer[this.headerPosition] = code;
				const length = this.offset - (this.headerPosition + 1);
				this.buffer.writeInt32BE(length, this.headerPosition + 1);
			}
			return this.buffer.slice(code ? 0 : 5, this.offset);
		}
		flush(code) {
			const result = this.join(code);
			this.offset = 5;
			this.headerPosition = 0;
			this.buffer = Buffer.allocUnsafe(this.size);
			return result;
		}
	};
	exports.Writer = Writer;
}));

//#endregion
//#region ../../node_modules/.bun/pg-protocol@1.13.0/node_modules/pg-protocol/dist/serializer.js
var require_serializer = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.serialize = void 0;
	const buffer_writer_1 = require_buffer_writer();
	const writer = new buffer_writer_1.Writer();
	const startup = (opts) => {
		writer.addInt16(3).addInt16(0);
		for (const key of Object.keys(opts)) writer.addCString(key).addCString(opts[key]);
		writer.addCString("client_encoding").addCString("UTF8");
		const bodyBuffer = writer.addCString("").flush();
		const length = bodyBuffer.length + 4;
		return new buffer_writer_1.Writer().addInt32(length).add(bodyBuffer).flush();
	};
	const requestSsl = () => {
		const response = Buffer.allocUnsafe(8);
		response.writeInt32BE(8, 0);
		response.writeInt32BE(80877103, 4);
		return response;
	};
	const password = (password$1) => {
		return writer.addCString(password$1).flush(112);
	};
	const sendSASLInitialResponseMessage = function(mechanism, initialResponse) {
		writer.addCString(mechanism).addInt32(Buffer.byteLength(initialResponse)).addString(initialResponse);
		return writer.flush(112);
	};
	const sendSCRAMClientFinalMessage = function(additionalData) {
		return writer.addString(additionalData).flush(112);
	};
	const query = (text$1) => {
		return writer.addCString(text$1).flush(81);
	};
	const emptyArray = [];
	const parse$2 = (query$1) => {
		const name = query$1.name || "";
		if (name.length > 63) {
			console.error("Warning! Postgres only supports 63 characters for query names.");
			console.error("You supplied %s (%s)", name, name.length);
			console.error("This can cause conflicts and silent errors executing queries");
		}
		const types$4 = query$1.types || emptyArray;
		const len = types$4.length;
		const buffer = writer.addCString(name).addCString(query$1.text).addInt16(len);
		for (let i = 0; i < len; i++) buffer.addInt32(types$4[i]);
		return writer.flush(80);
	};
	const paramWriter = new buffer_writer_1.Writer();
	const writeValues = function(values, valueMapper) {
		for (let i = 0; i < values.length; i++) {
			const mappedVal = valueMapper ? valueMapper(values[i], i) : values[i];
			if (mappedVal == null) {
				writer.addInt16(0);
				paramWriter.addInt32(-1);
			} else if (mappedVal instanceof Buffer) {
				writer.addInt16(1);
				paramWriter.addInt32(mappedVal.length);
				paramWriter.add(mappedVal);
			} else {
				writer.addInt16(0);
				paramWriter.addInt32(Buffer.byteLength(mappedVal));
				paramWriter.addString(mappedVal);
			}
		}
	};
	const bind = (config = {}) => {
		const portal = config.portal || "";
		const statement = config.statement || "";
		const binary = config.binary || false;
		const values = config.values || emptyArray;
		const len = values.length;
		writer.addCString(portal).addCString(statement);
		writer.addInt16(len);
		writeValues(values, config.valueMapper);
		writer.addInt16(len);
		writer.add(paramWriter.flush());
		writer.addInt16(1);
		writer.addInt16(binary ? 1 : 0);
		return writer.flush(66);
	};
	const emptyExecute = Buffer.from([
		69,
		0,
		0,
		0,
		9,
		0,
		0,
		0,
		0,
		0
	]);
	const execute = (config) => {
		if (!config || !config.portal && !config.rows) return emptyExecute;
		const portal = config.portal || "";
		const rows = config.rows || 0;
		const portalLength = Buffer.byteLength(portal);
		const len = 4 + portalLength + 1 + 4;
		const buff = Buffer.allocUnsafe(1 + len);
		buff[0] = 69;
		buff.writeInt32BE(len, 1);
		buff.write(portal, 5, "utf-8");
		buff[portalLength + 5] = 0;
		buff.writeUInt32BE(rows, buff.length - 4);
		return buff;
	};
	const cancel = (processID, secretKey) => {
		const buffer = Buffer.allocUnsafe(16);
		buffer.writeInt32BE(16, 0);
		buffer.writeInt16BE(1234, 4);
		buffer.writeInt16BE(5678, 6);
		buffer.writeInt32BE(processID, 8);
		buffer.writeInt32BE(secretKey, 12);
		return buffer;
	};
	const cstringMessage = (code, string) => {
		const len = 4 + Buffer.byteLength(string) + 1;
		const buffer = Buffer.allocUnsafe(1 + len);
		buffer[0] = code;
		buffer.writeInt32BE(len, 1);
		buffer.write(string, 5, "utf-8");
		buffer[len] = 0;
		return buffer;
	};
	const emptyDescribePortal = writer.addCString("P").flush(68);
	const emptyDescribeStatement = writer.addCString("S").flush(68);
	const describe = (msg) => {
		return msg.name ? cstringMessage(68, `${msg.type}${msg.name || ""}`) : msg.type === "P" ? emptyDescribePortal : emptyDescribeStatement;
	};
	const close = (msg) => {
		return cstringMessage(67, `${msg.type}${msg.name || ""}`);
	};
	const copyData = (chunk) => {
		return writer.add(chunk).flush(100);
	};
	const copyFail = (message) => {
		return cstringMessage(102, message);
	};
	const codeOnlyBuffer = (code) => Buffer.from([
		code,
		0,
		0,
		0,
		4
	]);
	const flushBuffer$1 = codeOnlyBuffer(72);
	const syncBuffer$1 = codeOnlyBuffer(83);
	const endBuffer$1 = codeOnlyBuffer(88);
	const copyDoneBuffer = codeOnlyBuffer(99);
	const serialize$1 = {
		startup,
		password,
		requestSsl,
		sendSASLInitialResponseMessage,
		sendSCRAMClientFinalMessage,
		query,
		parse: parse$2,
		bind,
		execute,
		describe,
		close,
		flush: () => flushBuffer$1,
		sync: () => syncBuffer$1,
		end: () => endBuffer$1,
		copyData,
		copyDone: () => copyDoneBuffer,
		copyFail,
		cancel
	};
	exports.serialize = serialize$1;
}));

//#endregion
//#region ../../node_modules/.bun/pg-protocol@1.13.0/node_modules/pg-protocol/dist/buffer-reader.js
var require_buffer_reader = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.BufferReader = void 0;
	var BufferReader = class {
		constructor(offset = 0) {
			this.offset = offset;
			this.buffer = Buffer.allocUnsafe(0);
			this.encoding = "utf-8";
		}
		setBuffer(offset, buffer) {
			this.offset = offset;
			this.buffer = buffer;
		}
		int16() {
			const result = this.buffer.readInt16BE(this.offset);
			this.offset += 2;
			return result;
		}
		byte() {
			const result = this.buffer[this.offset];
			this.offset++;
			return result;
		}
		int32() {
			const result = this.buffer.readInt32BE(this.offset);
			this.offset += 4;
			return result;
		}
		uint32() {
			const result = this.buffer.readUInt32BE(this.offset);
			this.offset += 4;
			return result;
		}
		string(length) {
			const result = this.buffer.toString(this.encoding, this.offset, this.offset + length);
			this.offset += length;
			return result;
		}
		cstring() {
			const start = this.offset;
			let end = start;
			while (this.buffer[end++] !== 0);
			this.offset = end;
			return this.buffer.toString(this.encoding, start, end - 1);
		}
		bytes(length) {
			const result = this.buffer.slice(this.offset, this.offset + length);
			this.offset += length;
			return result;
		}
	};
	exports.BufferReader = BufferReader;
}));

//#endregion
//#region ../../node_modules/.bun/pg-protocol@1.13.0/node_modules/pg-protocol/dist/parser.js
var require_parser = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.Parser = void 0;
	const messages_1$1 = require_messages();
	const buffer_reader_1 = require_buffer_reader();
	const CODE_LENGTH = 1;
	const HEADER_LENGTH = CODE_LENGTH + 4;
	const LATEINIT_LENGTH = -1;
	const emptyBuffer = Buffer.allocUnsafe(0);
	var Parser = class {
		constructor(opts) {
			this.buffer = emptyBuffer;
			this.bufferLength = 0;
			this.bufferOffset = 0;
			this.reader = new buffer_reader_1.BufferReader();
			if ((opts === null || opts === void 0 ? void 0 : opts.mode) === "binary") throw new Error("Binary mode not supported yet");
			this.mode = (opts === null || opts === void 0 ? void 0 : opts.mode) || "text";
		}
		parse(buffer, callback) {
			this.mergeBuffer(buffer);
			const bufferFullLength = this.bufferOffset + this.bufferLength;
			let offset = this.bufferOffset;
			while (offset + HEADER_LENGTH <= bufferFullLength) {
				const code = this.buffer[offset];
				const length = this.buffer.readUInt32BE(offset + CODE_LENGTH);
				const fullMessageLength = CODE_LENGTH + length;
				if (fullMessageLength + offset <= bufferFullLength) {
					callback(this.handlePacket(offset + HEADER_LENGTH, code, length, this.buffer));
					offset += fullMessageLength;
				} else break;
			}
			if (offset === bufferFullLength) {
				this.buffer = emptyBuffer;
				this.bufferLength = 0;
				this.bufferOffset = 0;
			} else {
				this.bufferLength = bufferFullLength - offset;
				this.bufferOffset = offset;
			}
		}
		mergeBuffer(buffer) {
			if (this.bufferLength > 0) {
				const newLength = this.bufferLength + buffer.byteLength;
				if (newLength + this.bufferOffset > this.buffer.byteLength) {
					let newBuffer;
					if (newLength <= this.buffer.byteLength && this.bufferOffset >= this.bufferLength) newBuffer = this.buffer;
					else {
						let newBufferLength = this.buffer.byteLength * 2;
						while (newLength >= newBufferLength) newBufferLength *= 2;
						newBuffer = Buffer.allocUnsafe(newBufferLength);
					}
					this.buffer.copy(newBuffer, 0, this.bufferOffset, this.bufferOffset + this.bufferLength);
					this.buffer = newBuffer;
					this.bufferOffset = 0;
				}
				buffer.copy(this.buffer, this.bufferOffset + this.bufferLength);
				this.bufferLength = newLength;
			} else {
				this.buffer = buffer;
				this.bufferOffset = 0;
				this.bufferLength = buffer.byteLength;
			}
		}
		handlePacket(offset, code, length, bytes) {
			const { reader } = this;
			reader.setBuffer(offset, bytes);
			let message;
			switch (code) {
				case 50:
					message = messages_1$1.bindComplete;
					break;
				case 49:
					message = messages_1$1.parseComplete;
					break;
				case 51:
					message = messages_1$1.closeComplete;
					break;
				case 110:
					message = messages_1$1.noData;
					break;
				case 115:
					message = messages_1$1.portalSuspended;
					break;
				case 99:
					message = messages_1$1.copyDone;
					break;
				case 87:
					message = messages_1$1.replicationStart;
					break;
				case 73:
					message = messages_1$1.emptyQuery;
					break;
				case 68:
					message = parseDataRowMessage(reader);
					break;
				case 67:
					message = parseCommandCompleteMessage(reader);
					break;
				case 90:
					message = parseReadyForQueryMessage(reader);
					break;
				case 65:
					message = parseNotificationMessage(reader);
					break;
				case 82:
					message = parseAuthenticationResponse(reader, length);
					break;
				case 83:
					message = parseParameterStatusMessage(reader);
					break;
				case 75:
					message = parseBackendKeyData(reader);
					break;
				case 69:
					message = parseErrorMessage(reader, "error");
					break;
				case 78:
					message = parseErrorMessage(reader, "notice");
					break;
				case 84:
					message = parseRowDescriptionMessage(reader);
					break;
				case 116:
					message = parseParameterDescriptionMessage(reader);
					break;
				case 71:
					message = parseCopyInMessage(reader);
					break;
				case 72:
					message = parseCopyOutMessage(reader);
					break;
				case 100:
					message = parseCopyData(reader, length);
					break;
				default: return new messages_1$1.DatabaseError("received invalid response: " + code.toString(16), length, "error");
			}
			reader.setBuffer(0, emptyBuffer);
			message.length = length;
			return message;
		}
	};
	exports.Parser = Parser;
	const parseReadyForQueryMessage = (reader) => {
		const status = reader.string(1);
		return new messages_1$1.ReadyForQueryMessage(LATEINIT_LENGTH, status);
	};
	const parseCommandCompleteMessage = (reader) => {
		const text$1 = reader.cstring();
		return new messages_1$1.CommandCompleteMessage(LATEINIT_LENGTH, text$1);
	};
	const parseCopyData = (reader, length) => {
		const chunk = reader.bytes(length - 4);
		return new messages_1$1.CopyDataMessage(LATEINIT_LENGTH, chunk);
	};
	const parseCopyInMessage = (reader) => parseCopyMessage(reader, "copyInResponse");
	const parseCopyOutMessage = (reader) => parseCopyMessage(reader, "copyOutResponse");
	const parseCopyMessage = (reader, messageName) => {
		const isBinary = reader.byte() !== 0;
		const columnCount = reader.int16();
		const message = new messages_1$1.CopyResponse(LATEINIT_LENGTH, messageName, isBinary, columnCount);
		for (let i = 0; i < columnCount; i++) message.columnTypes[i] = reader.int16();
		return message;
	};
	const parseNotificationMessage = (reader) => {
		const processId = reader.int32();
		const channel = reader.cstring();
		const payload = reader.cstring();
		return new messages_1$1.NotificationResponseMessage(LATEINIT_LENGTH, processId, channel, payload);
	};
	const parseRowDescriptionMessage = (reader) => {
		const fieldCount = reader.int16();
		const message = new messages_1$1.RowDescriptionMessage(LATEINIT_LENGTH, fieldCount);
		for (let i = 0; i < fieldCount; i++) message.fields[i] = parseField(reader);
		return message;
	};
	const parseField = (reader) => {
		const name = reader.cstring();
		const tableID = reader.uint32();
		const columnID = reader.int16();
		const dataTypeID = reader.uint32();
		const dataTypeSize = reader.int16();
		const dataTypeModifier = reader.int32();
		const mode = reader.int16() === 0 ? "text" : "binary";
		return new messages_1$1.Field(name, tableID, columnID, dataTypeID, dataTypeSize, dataTypeModifier, mode);
	};
	const parseParameterDescriptionMessage = (reader) => {
		const parameterCount = reader.int16();
		const message = new messages_1$1.ParameterDescriptionMessage(LATEINIT_LENGTH, parameterCount);
		for (let i = 0; i < parameterCount; i++) message.dataTypeIDs[i] = reader.int32();
		return message;
	};
	const parseDataRowMessage = (reader) => {
		const fieldCount = reader.int16();
		const fields = new Array(fieldCount);
		for (let i = 0; i < fieldCount; i++) {
			const len = reader.int32();
			fields[i] = len === -1 ? null : reader.string(len);
		}
		return new messages_1$1.DataRowMessage(LATEINIT_LENGTH, fields);
	};
	const parseParameterStatusMessage = (reader) => {
		const name = reader.cstring();
		const value = reader.cstring();
		return new messages_1$1.ParameterStatusMessage(LATEINIT_LENGTH, name, value);
	};
	const parseBackendKeyData = (reader) => {
		const processID = reader.int32();
		const secretKey = reader.int32();
		return new messages_1$1.BackendKeyDataMessage(LATEINIT_LENGTH, processID, secretKey);
	};
	const parseAuthenticationResponse = (reader, length) => {
		const code = reader.int32();
		const message = {
			name: "authenticationOk",
			length
		};
		switch (code) {
			case 0: break;
			case 3:
				if (message.length === 8) message.name = "authenticationCleartextPassword";
				break;
			case 5:
				if (message.length === 12) {
					message.name = "authenticationMD5Password";
					const salt = reader.bytes(4);
					return new messages_1$1.AuthenticationMD5Password(LATEINIT_LENGTH, salt);
				}
				break;
			case 10:
				{
					message.name = "authenticationSASL";
					message.mechanisms = [];
					let mechanism;
					do {
						mechanism = reader.cstring();
						if (mechanism) message.mechanisms.push(mechanism);
					} while (mechanism);
				}
				break;
			case 11:
				message.name = "authenticationSASLContinue";
				message.data = reader.string(length - 8);
				break;
			case 12:
				message.name = "authenticationSASLFinal";
				message.data = reader.string(length - 8);
				break;
			default: throw new Error("Unknown authenticationOk message type " + code);
		}
		return message;
	};
	const parseErrorMessage = (reader, name) => {
		const fields = {};
		let fieldType = reader.string(1);
		while (fieldType !== "\0") {
			fields[fieldType] = reader.cstring();
			fieldType = reader.string(1);
		}
		const messageValue = fields.M;
		const message = name === "notice" ? new messages_1$1.NoticeMessage(LATEINIT_LENGTH, messageValue) : new messages_1$1.DatabaseError(messageValue, LATEINIT_LENGTH, name);
		message.severity = fields.S;
		message.code = fields.C;
		message.detail = fields.D;
		message.hint = fields.H;
		message.position = fields.P;
		message.internalPosition = fields.p;
		message.internalQuery = fields.q;
		message.where = fields.W;
		message.schema = fields.s;
		message.table = fields.t;
		message.column = fields.c;
		message.dataType = fields.d;
		message.constraint = fields.n;
		message.file = fields.F;
		message.line = fields.L;
		message.routine = fields.R;
		return message;
	};
}));

//#endregion
//#region ../../node_modules/.bun/pg-protocol@1.13.0/node_modules/pg-protocol/dist/index.js
var require_dist = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.DatabaseError = exports.serialize = exports.parse = void 0;
	const messages_1 = require_messages();
	Object.defineProperty(exports, "DatabaseError", {
		enumerable: true,
		get: function() {
			return messages_1.DatabaseError;
		}
	});
	const serializer_1 = require_serializer();
	Object.defineProperty(exports, "serialize", {
		enumerable: true,
		get: function() {
			return serializer_1.serialize;
		}
	});
	const parser_1 = require_parser();
	function parse$1(stream, callback) {
		const parser = new parser_1.Parser();
		stream.on("data", (buffer) => parser.parse(buffer, callback));
		return new Promise((resolve) => stream.on("end", () => resolve()));
	}
	exports.parse = parse$1;
}));

//#endregion
//#region ../../node_modules/.bun/pg-cloudflare@1.3.0/node_modules/pg-cloudflare/dist/empty.js
var require_empty = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.default = {};
}));

//#endregion
//#region ../../node_modules/.bun/pg@8.20.0+52bd52a0bccfa6a2/node_modules/pg/lib/stream.js
var require_stream = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const { getStream: getStream$1, getSecureStream: getSecureStream$1 } = getStreamFuncs();
	module.exports = {
		getStream: getStream$1,
		getSecureStream: getSecureStream$1
	};
	/**
	* The stream functions that work in Node.js
	*/
	function getNodejsStreamFuncs() {
		function getStream$2(ssl) {
			return new (__require("net")).Socket();
		}
		function getSecureStream$2(options) {
			return __require("tls").connect(options);
		}
		return {
			getStream: getStream$2,
			getSecureStream: getSecureStream$2
		};
	}
	/**
	* The stream functions that work in Cloudflare Workers
	*/
	function getCloudflareStreamFuncs() {
		function getStream$2(ssl) {
			const { CloudflareSocket } = require_empty();
			return new CloudflareSocket(ssl);
		}
		function getSecureStream$2(options) {
			options.socket.startTls(options);
			return options.socket;
		}
		return {
			getStream: getStream$2,
			getSecureStream: getSecureStream$2
		};
	}
	/**
	* Are we running in a Cloudflare Worker?
	*
	* @returns true if the code is currently running inside a Cloudflare Worker.
	*/
	function isCloudflareRuntime() {
		if (typeof navigator === "object" && navigator !== null && typeof navigator.userAgent === "string") return navigator.userAgent === "Cloudflare-Workers";
		if (typeof Response === "function") {
			const resp = new Response(null, { cf: { thing: true } });
			if (typeof resp.cf === "object" && resp.cf !== null && resp.cf.thing) return true;
		}
		return false;
	}
	function getStreamFuncs() {
		if (isCloudflareRuntime()) return getCloudflareStreamFuncs();
		return getNodejsStreamFuncs();
	}
}));

//#endregion
//#region ../../node_modules/.bun/pg@8.20.0+52bd52a0bccfa6a2/node_modules/pg/lib/connection.js
var require_connection = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const EventEmitter$4 = __require("events").EventEmitter;
	const { parse, serialize } = require_dist();
	const { getStream, getSecureStream } = require_stream();
	const flushBuffer = serialize.flush();
	const syncBuffer = serialize.sync();
	const endBuffer = serialize.end();
	var Connection$3 = class extends EventEmitter$4 {
		constructor(config) {
			super();
			config = config || {};
			this.stream = config.stream || getStream(config.ssl);
			if (typeof this.stream === "function") this.stream = this.stream(config);
			this._keepAlive = config.keepAlive;
			this._keepAliveInitialDelayMillis = config.keepAliveInitialDelayMillis;
			this.parsedStatements = {};
			this.ssl = config.ssl || false;
			this._ending = false;
			this._emitMessage = false;
			const self = this;
			this.on("newListener", function(eventName) {
				if (eventName === "message") self._emitMessage = true;
			});
		}
		connect(port, host) {
			const self = this;
			this._connecting = true;
			this.stream.setNoDelay(true);
			this.stream.connect(port, host);
			this.stream.once("connect", function() {
				if (self._keepAlive) self.stream.setKeepAlive(true, self._keepAliveInitialDelayMillis);
				self.emit("connect");
			});
			const reportStreamError = function(error) {
				if (self._ending && (error.code === "ECONNRESET" || error.code === "EPIPE")) return;
				self.emit("error", error);
			};
			this.stream.on("error", reportStreamError);
			this.stream.on("close", function() {
				self.emit("end");
			});
			if (!this.ssl) return this.attachListeners(this.stream);
			this.stream.once("data", function(buffer) {
				switch (buffer.toString("utf8")) {
					case "S": break;
					case "N":
						self.stream.end();
						return self.emit("error", /* @__PURE__ */ new Error("The server does not support SSL connections"));
					default:
						self.stream.end();
						return self.emit("error", /* @__PURE__ */ new Error("There was an error establishing an SSL connection"));
				}
				const options = { socket: self.stream };
				if (self.ssl !== true) {
					Object.assign(options, self.ssl);
					if ("key" in self.ssl) options.key = self.ssl.key;
				}
				const net = __require("net");
				if (net.isIP && net.isIP(host) === 0) options.servername = host;
				try {
					self.stream = getSecureStream(options);
				} catch (err) {
					return self.emit("error", err);
				}
				self.attachListeners(self.stream);
				self.stream.on("error", reportStreamError);
				self.emit("sslconnect");
			});
		}
		attachListeners(stream) {
			parse(stream, (msg) => {
				const eventName = msg.name === "error" ? "errorMessage" : msg.name;
				if (this._emitMessage) this.emit("message", msg);
				this.emit(eventName, msg);
			});
		}
		requestSsl() {
			this.stream.write(serialize.requestSsl());
		}
		startup(config) {
			this.stream.write(serialize.startup(config));
		}
		cancel(processID, secretKey) {
			this._send(serialize.cancel(processID, secretKey));
		}
		password(password$1) {
			this._send(serialize.password(password$1));
		}
		sendSASLInitialResponseMessage(mechanism, initialResponse) {
			this._send(serialize.sendSASLInitialResponseMessage(mechanism, initialResponse));
		}
		sendSCRAMClientFinalMessage(additionalData) {
			this._send(serialize.sendSCRAMClientFinalMessage(additionalData));
		}
		_send(buffer) {
			if (!this.stream.writable) return false;
			return this.stream.write(buffer);
		}
		query(text$1) {
			this._send(serialize.query(text$1));
		}
		parse(query$1) {
			this._send(serialize.parse(query$1));
		}
		bind(config) {
			this._send(serialize.bind(config));
		}
		execute(config) {
			this._send(serialize.execute(config));
		}
		flush() {
			if (this.stream.writable) this.stream.write(flushBuffer);
		}
		sync() {
			this._ending = true;
			this._send(syncBuffer);
		}
		ref() {
			this.stream.ref();
		}
		unref() {
			this.stream.unref();
		}
		end() {
			this._ending = true;
			if (!this._connecting || !this.stream.writable) {
				this.stream.end();
				return;
			}
			return this.stream.write(endBuffer, () => {
				this.stream.end();
			});
		}
		close(msg) {
			this._send(serialize.close(msg));
		}
		describe(msg) {
			this._send(serialize.describe(msg));
		}
		sendCopyFromChunk(chunk) {
			this._send(serialize.copyData(chunk));
		}
		endCopyFrom() {
			this._send(serialize.copyDone());
		}
		sendCopyFail(msg) {
			this._send(serialize.copyFail(msg));
		}
	};
	module.exports = Connection$3;
}));

//#endregion
//#region ../../node_modules/.bun/split2@4.2.0/node_modules/split2/index.js
var require_split2 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const { Transform } = __require("stream");
	const { StringDecoder } = __require("string_decoder");
	const kLast = Symbol("last");
	const kDecoder = Symbol("decoder");
	function transform(chunk, enc, cb) {
		let list;
		if (this.overflow) {
			list = this[kDecoder].write(chunk).split(this.matcher);
			if (list.length === 1) return cb();
			list.shift();
			this.overflow = false;
		} else {
			this[kLast] += this[kDecoder].write(chunk);
			list = this[kLast].split(this.matcher);
		}
		this[kLast] = list.pop();
		for (let i = 0; i < list.length; i++) try {
			push(this, this.mapper(list[i]));
		} catch (error) {
			return cb(error);
		}
		this.overflow = this[kLast].length > this.maxLength;
		if (this.overflow && !this.skipOverflow) {
			cb(/* @__PURE__ */ new Error("maximum buffer reached"));
			return;
		}
		cb();
	}
	function flush(cb) {
		this[kLast] += this[kDecoder].end();
		if (this[kLast]) try {
			push(this, this.mapper(this[kLast]));
		} catch (error) {
			return cb(error);
		}
		cb();
	}
	function push(self, val$1) {
		if (val$1 !== void 0) self.push(val$1);
	}
	function noop(incoming) {
		return incoming;
	}
	function split$1(matcher$1, mapper, options) {
		matcher$1 = matcher$1 || /\r?\n/;
		mapper = mapper || noop;
		options = options || {};
		switch (arguments.length) {
			case 1:
				if (typeof matcher$1 === "function") {
					mapper = matcher$1;
					matcher$1 = /\r?\n/;
				} else if (typeof matcher$1 === "object" && !(matcher$1 instanceof RegExp) && !matcher$1[Symbol.split]) {
					options = matcher$1;
					matcher$1 = /\r?\n/;
				}
				break;
			case 2: if (typeof matcher$1 === "function") {
				options = mapper;
				mapper = matcher$1;
				matcher$1 = /\r?\n/;
			} else if (typeof mapper === "object") {
				options = mapper;
				mapper = noop;
			}
		}
		options = Object.assign({}, options);
		options.autoDestroy = true;
		options.transform = transform;
		options.flush = flush;
		options.readableObjectMode = true;
		const stream = new Transform(options);
		stream[kLast] = "";
		stream[kDecoder] = new StringDecoder("utf8");
		stream.matcher = matcher$1;
		stream.mapper = mapper;
		stream.maxLength = options.maxLength;
		stream.skipOverflow = options.skipOverflow || false;
		stream.overflow = false;
		stream._destroy = function(err, cb) {
			this._writableState.errorEmitted = false;
			cb(err);
		};
		return stream;
	}
	module.exports = split$1;
}));

//#endregion
//#region ../../node_modules/.bun/pgpass@1.0.5/node_modules/pgpass/lib/helper.js
var require_helper = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var path = __require("path"), Stream = __require("stream").Stream, split = require_split2(), util$2 = __require("util"), defaultPort = 5432, isWin = process.platform === "win32", warnStream = process.stderr;
	var S_IRWXG = 56, S_IRWXO = 7, S_IFMT = 61440, S_IFREG = 32768;
	function isRegFile(mode) {
		return (mode & S_IFMT) == S_IFREG;
	}
	var fieldNames = [
		"host",
		"port",
		"database",
		"user",
		"password"
	];
	var nrOfFields = fieldNames.length;
	var passKey = fieldNames[nrOfFields - 1];
	function warn() {
		if (warnStream instanceof Stream && true === warnStream.writable) {
			var args = Array.prototype.slice.call(arguments).concat("\n");
			warnStream.write(util$2.format.apply(util$2, args));
		}
	}
	Object.defineProperty(module.exports, "isWin", {
		get: function() {
			return isWin;
		},
		set: function(val$1) {
			isWin = val$1;
		}
	});
	module.exports.warnTo = function(stream) {
		var old = warnStream;
		warnStream = stream;
		return old;
	};
	module.exports.getFileName = function(rawEnv) {
		var env$1 = rawEnv || process.env;
		return env$1.PGPASSFILE || (isWin ? path.join(env$1.APPDATA || "./", "postgresql", "pgpass.conf") : path.join(env$1.HOME || "./", ".pgpass"));
	};
	module.exports.usePgPass = function(stats, fname) {
		if (Object.prototype.hasOwnProperty.call(process.env, "PGPASSWORD")) return false;
		if (isWin) return true;
		fname = fname || "<unkn>";
		if (!isRegFile(stats.mode)) {
			warn("WARNING: password file \"%s\" is not a plain file", fname);
			return false;
		}
		if (stats.mode & (S_IRWXG | S_IRWXO)) {
			warn("WARNING: password file \"%s\" has group or world access; permissions should be u=rw (0600) or less", fname);
			return false;
		}
		return true;
	};
	var matcher = module.exports.match = function(connInfo, entry) {
		return fieldNames.slice(0, -1).reduce(function(prev, field, idx) {
			if (idx == 1) {
				if (Number(connInfo[field] || defaultPort) === Number(entry[field])) return prev && true;
			}
			return prev && (entry[field] === "*" || entry[field] === connInfo[field]);
		}, true);
	};
	module.exports.getPassword = function(connInfo, stream, cb) {
		var pass;
		var lineStream = stream.pipe(split());
		function onLine(line$1) {
			var entry = parseLine(line$1);
			if (entry && isValidEntry(entry) && matcher(connInfo, entry)) {
				pass = entry[passKey];
				lineStream.end();
			}
		}
		var onEnd = function() {
			stream.destroy();
			cb(pass);
		};
		var onErr = function(err) {
			stream.destroy();
			warn("WARNING: error on reading file: %s", err);
			cb(void 0);
		};
		stream.on("error", onErr);
		lineStream.on("data", onLine).on("end", onEnd).on("error", onErr);
	};
	var parseLine = module.exports.parseLine = function(line$1) {
		if (line$1.length < 11 || line$1.match(/^\s+#/)) return null;
		var curChar = "";
		var prevChar = "";
		var fieldIdx = 0;
		var startIdx = 0;
		var obj = {};
		var isLastField = false;
		var addToObj = function(idx, i0, i1) {
			var field = line$1.substring(i0, i1);
			if (!Object.hasOwnProperty.call(process.env, "PGPASS_NO_DEESCAPE")) field = field.replace(/\\([:\\])/g, "$1");
			obj[fieldNames[idx]] = field;
		};
		for (var i = 0; i < line$1.length - 1; i += 1) {
			curChar = line$1.charAt(i + 1);
			prevChar = line$1.charAt(i);
			isLastField = fieldIdx == nrOfFields - 1;
			if (isLastField) {
				addToObj(fieldIdx, startIdx);
				break;
			}
			if (i >= 0 && curChar == ":" && prevChar !== "\\") {
				addToObj(fieldIdx, startIdx, i + 1);
				startIdx = i + 2;
				fieldIdx += 1;
			}
		}
		obj = Object.keys(obj).length === nrOfFields ? obj : null;
		return obj;
	};
	var isValidEntry = module.exports.isValidEntry = function(entry) {
		var rules = {
			0: function(x) {
				return x.length > 0;
			},
			1: function(x) {
				if (x === "*") return true;
				x = Number(x);
				return isFinite(x) && x > 0 && x < 9007199254740992 && Math.floor(x) === x;
			},
			2: function(x) {
				return x.length > 0;
			},
			3: function(x) {
				return x.length > 0;
			},
			4: function(x) {
				return x.length > 0;
			}
		};
		for (var idx = 0; idx < fieldNames.length; idx += 1) {
			var rule = rules[idx];
			if (!rule(entry[fieldNames[idx]] || "")) return false;
		}
		return true;
	};
}));

//#endregion
//#region ../../node_modules/.bun/pgpass@1.0.5/node_modules/pgpass/lib/index.js
var require_lib$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	__require("path");
	var fs = __require("fs"), helper = require_helper();
	module.exports = function(connInfo, cb) {
		var file = helper.getFileName();
		fs.stat(file, function(err, stat) {
			if (err || !helper.usePgPass(stat, file)) return cb(void 0);
			var st = fs.createReadStream(file);
			helper.getPassword(connInfo, st, cb);
		});
	};
	module.exports.warnTo = helper.warnTo;
}));

//#endregion
//#region ../../node_modules/.bun/pg@8.20.0+52bd52a0bccfa6a2/node_modules/pg/lib/client.js
var require_client$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const EventEmitter$3 = __require("events").EventEmitter;
	const utils$2 = require_utils$1();
	const nodeUtils$1 = __require("util");
	const sasl = require_sasl();
	const TypeOverrides$3 = require_type_overrides();
	const ConnectionParameters$1 = require_connection_parameters();
	const Query$1 = require_query$1();
	const defaults$2 = require_defaults();
	const Connection$2 = require_connection();
	const crypto$1 = require_utils();
	const activeQueryDeprecationNotice = nodeUtils$1.deprecate(() => {}, "Client.activeQuery is deprecated and will be removed in pg@9.0");
	const queryQueueDeprecationNotice = nodeUtils$1.deprecate(() => {}, "Client.queryQueue is deprecated and will be removed in pg@9.0.");
	const pgPassDeprecationNotice = nodeUtils$1.deprecate(() => {}, "pgpass support is deprecated and will be removed in pg@9.0. You can provide an async function as the password property to the Client/Pool constructor that returns a password instead. Within this function you can call the pgpass module in your own code.");
	const byoPromiseDeprecationNotice = nodeUtils$1.deprecate(() => {}, "Passing a custom Promise implementation to the Client/Pool constructor is deprecated and will be removed in pg@9.0.");
	const queryQueueLengthDeprecationNotice$1 = nodeUtils$1.deprecate(() => {}, "Calling client.query() when the client is already executing a query is deprecated and will be removed in pg@9.0. Use async/await or an external async flow control mechanism instead.");
	var Client$3 = class extends EventEmitter$3 {
		constructor(config) {
			super();
			this.connectionParameters = new ConnectionParameters$1(config);
			this.user = this.connectionParameters.user;
			this.database = this.connectionParameters.database;
			this.port = this.connectionParameters.port;
			this.host = this.connectionParameters.host;
			Object.defineProperty(this, "password", {
				configurable: true,
				enumerable: false,
				writable: true,
				value: this.connectionParameters.password
			});
			this.replication = this.connectionParameters.replication;
			const c = config || {};
			if (c.Promise) byoPromiseDeprecationNotice();
			this._Promise = c.Promise || global.Promise;
			this._types = new TypeOverrides$3(c.types);
			this._ending = false;
			this._ended = false;
			this._connecting = false;
			this._connected = false;
			this._connectionError = false;
			this._queryable = true;
			this._activeQuery = null;
			this.enableChannelBinding = Boolean(c.enableChannelBinding);
			this.connection = c.connection || new Connection$2({
				stream: c.stream,
				ssl: this.connectionParameters.ssl,
				keepAlive: c.keepAlive || false,
				keepAliveInitialDelayMillis: c.keepAliveInitialDelayMillis || 0,
				encoding: this.connectionParameters.client_encoding || "utf8"
			});
			this._queryQueue = [];
			this.binary = c.binary || defaults$2.binary;
			this.processID = null;
			this.secretKey = null;
			this.ssl = this.connectionParameters.ssl || false;
			if (this.ssl && this.ssl.key) Object.defineProperty(this.ssl, "key", { enumerable: false });
			this._connectionTimeoutMillis = c.connectionTimeoutMillis || 0;
		}
		get activeQuery() {
			activeQueryDeprecationNotice();
			return this._activeQuery;
		}
		set activeQuery(val$1) {
			activeQueryDeprecationNotice();
			this._activeQuery = val$1;
		}
		_getActiveQuery() {
			return this._activeQuery;
		}
		_errorAllQueries(err) {
			const enqueueError = (query$1) => {
				process.nextTick(() => {
					query$1.handleError(err, this.connection);
				});
			};
			const activeQuery = this._getActiveQuery();
			if (activeQuery) {
				enqueueError(activeQuery);
				this._activeQuery = null;
			}
			this._queryQueue.forEach(enqueueError);
			this._queryQueue.length = 0;
		}
		_connect(callback) {
			const self = this;
			const con = this.connection;
			this._connectionCallback = callback;
			if (this._connecting || this._connected) {
				const err = /* @__PURE__ */ new Error("Client has already been connected. You cannot reuse a client.");
				process.nextTick(() => {
					callback(err);
				});
				return;
			}
			this._connecting = true;
			if (this._connectionTimeoutMillis > 0) {
				this.connectionTimeoutHandle = setTimeout(() => {
					con._ending = true;
					con.stream.destroy(/* @__PURE__ */ new Error("timeout expired"));
				}, this._connectionTimeoutMillis);
				if (this.connectionTimeoutHandle.unref) this.connectionTimeoutHandle.unref();
			}
			if (this.host && this.host.indexOf("/") === 0) con.connect(this.host + "/.s.PGSQL." + this.port);
			else con.connect(this.port, this.host);
			con.on("connect", function() {
				if (self.ssl) con.requestSsl();
				else con.startup(self.getStartupConf());
			});
			con.on("sslconnect", function() {
				con.startup(self.getStartupConf());
			});
			this._attachListeners(con);
			con.once("end", () => {
				const error = this._ending ? /* @__PURE__ */ new Error("Connection terminated") : /* @__PURE__ */ new Error("Connection terminated unexpectedly");
				clearTimeout(this.connectionTimeoutHandle);
				this._errorAllQueries(error);
				this._ended = true;
				if (!this._ending) {
					if (this._connecting && !this._connectionError) if (this._connectionCallback) this._connectionCallback(error);
					else this._handleErrorEvent(error);
					else if (!this._connectionError) this._handleErrorEvent(error);
				}
				process.nextTick(() => {
					this.emit("end");
				});
			});
		}
		connect(callback) {
			if (callback) {
				this._connect(callback);
				return;
			}
			return new this._Promise((resolve, reject) => {
				this._connect((error) => {
					if (error) reject(error);
					else resolve(this);
				});
			});
		}
		_attachListeners(con) {
			con.on("authenticationCleartextPassword", this._handleAuthCleartextPassword.bind(this));
			con.on("authenticationMD5Password", this._handleAuthMD5Password.bind(this));
			con.on("authenticationSASL", this._handleAuthSASL.bind(this));
			con.on("authenticationSASLContinue", this._handleAuthSASLContinue.bind(this));
			con.on("authenticationSASLFinal", this._handleAuthSASLFinal.bind(this));
			con.on("backendKeyData", this._handleBackendKeyData.bind(this));
			con.on("error", this._handleErrorEvent.bind(this));
			con.on("errorMessage", this._handleErrorMessage.bind(this));
			con.on("readyForQuery", this._handleReadyForQuery.bind(this));
			con.on("notice", this._handleNotice.bind(this));
			con.on("rowDescription", this._handleRowDescription.bind(this));
			con.on("dataRow", this._handleDataRow.bind(this));
			con.on("portalSuspended", this._handlePortalSuspended.bind(this));
			con.on("emptyQuery", this._handleEmptyQuery.bind(this));
			con.on("commandComplete", this._handleCommandComplete.bind(this));
			con.on("parseComplete", this._handleParseComplete.bind(this));
			con.on("copyInResponse", this._handleCopyInResponse.bind(this));
			con.on("copyData", this._handleCopyData.bind(this));
			con.on("notification", this._handleNotification.bind(this));
		}
		_getPassword(cb) {
			const con = this.connection;
			if (typeof this.password === "function") this._Promise.resolve().then(() => this.password(this.connectionParameters)).then((pass) => {
				if (pass !== void 0) {
					if (typeof pass !== "string") {
						con.emit("error", /* @__PURE__ */ new TypeError("Password must be a string"));
						return;
					}
					this.connectionParameters.password = this.password = pass;
				} else this.connectionParameters.password = this.password = null;
				cb();
			}).catch((err) => {
				con.emit("error", err);
			});
			else if (this.password !== null) cb();
			else try {
				require_lib$1()(this.connectionParameters, (pass) => {
					if (void 0 !== pass) {
						pgPassDeprecationNotice();
						this.connectionParameters.password = this.password = pass;
					}
					cb();
				});
			} catch (e) {
				this.emit("error", e);
			}
		}
		_handleAuthCleartextPassword(msg) {
			this._getPassword(() => {
				this.connection.password(this.password);
			});
		}
		_handleAuthMD5Password(msg) {
			this._getPassword(async () => {
				try {
					const hashedPassword = await crypto$1.postgresMd5PasswordHash(this.user, this.password, msg.salt);
					this.connection.password(hashedPassword);
				} catch (e) {
					this.emit("error", e);
				}
			});
		}
		_handleAuthSASL(msg) {
			this._getPassword(() => {
				try {
					this.saslSession = sasl.startSession(msg.mechanisms, this.enableChannelBinding && this.connection.stream);
					this.connection.sendSASLInitialResponseMessage(this.saslSession.mechanism, this.saslSession.response);
				} catch (err) {
					this.connection.emit("error", err);
				}
			});
		}
		async _handleAuthSASLContinue(msg) {
			try {
				await sasl.continueSession(this.saslSession, this.password, msg.data, this.enableChannelBinding && this.connection.stream);
				this.connection.sendSCRAMClientFinalMessage(this.saslSession.response);
			} catch (err) {
				this.connection.emit("error", err);
			}
		}
		_handleAuthSASLFinal(msg) {
			try {
				sasl.finalizeSession(this.saslSession, msg.data);
				this.saslSession = null;
			} catch (err) {
				this.connection.emit("error", err);
			}
		}
		_handleBackendKeyData(msg) {
			this.processID = msg.processID;
			this.secretKey = msg.secretKey;
		}
		_handleReadyForQuery(msg) {
			if (this._connecting) {
				this._connecting = false;
				this._connected = true;
				clearTimeout(this.connectionTimeoutHandle);
				if (this._connectionCallback) {
					this._connectionCallback(null, this);
					this._connectionCallback = null;
				}
				this.emit("connect");
			}
			const activeQuery = this._getActiveQuery();
			this._activeQuery = null;
			this.readyForQuery = true;
			if (activeQuery) activeQuery.handleReadyForQuery(this.connection);
			this._pulseQueryQueue();
		}
		_handleErrorWhileConnecting(err) {
			if (this._connectionError) return;
			this._connectionError = true;
			clearTimeout(this.connectionTimeoutHandle);
			if (this._connectionCallback) return this._connectionCallback(err);
			this.emit("error", err);
		}
		_handleErrorEvent(err) {
			if (this._connecting) return this._handleErrorWhileConnecting(err);
			this._queryable = false;
			this._errorAllQueries(err);
			this.emit("error", err);
		}
		_handleErrorMessage(msg) {
			if (this._connecting) return this._handleErrorWhileConnecting(msg);
			const activeQuery = this._getActiveQuery();
			if (!activeQuery) {
				this._handleErrorEvent(msg);
				return;
			}
			this._activeQuery = null;
			activeQuery.handleError(msg, this.connection);
		}
		_handleRowDescription(msg) {
			const activeQuery = this._getActiveQuery();
			if (activeQuery == null) {
				const error = /* @__PURE__ */ new Error("Received unexpected rowDescription message from backend.");
				this._handleErrorEvent(error);
				return;
			}
			activeQuery.handleRowDescription(msg);
		}
		_handleDataRow(msg) {
			const activeQuery = this._getActiveQuery();
			if (activeQuery == null) {
				const error = /* @__PURE__ */ new Error("Received unexpected dataRow message from backend.");
				this._handleErrorEvent(error);
				return;
			}
			activeQuery.handleDataRow(msg);
		}
		_handlePortalSuspended(msg) {
			const activeQuery = this._getActiveQuery();
			if (activeQuery == null) {
				const error = /* @__PURE__ */ new Error("Received unexpected portalSuspended message from backend.");
				this._handleErrorEvent(error);
				return;
			}
			activeQuery.handlePortalSuspended(this.connection);
		}
		_handleEmptyQuery(msg) {
			const activeQuery = this._getActiveQuery();
			if (activeQuery == null) {
				const error = /* @__PURE__ */ new Error("Received unexpected emptyQuery message from backend.");
				this._handleErrorEvent(error);
				return;
			}
			activeQuery.handleEmptyQuery(this.connection);
		}
		_handleCommandComplete(msg) {
			const activeQuery = this._getActiveQuery();
			if (activeQuery == null) {
				const error = /* @__PURE__ */ new Error("Received unexpected commandComplete message from backend.");
				this._handleErrorEvent(error);
				return;
			}
			activeQuery.handleCommandComplete(msg, this.connection);
		}
		_handleParseComplete() {
			const activeQuery = this._getActiveQuery();
			if (activeQuery == null) {
				const error = /* @__PURE__ */ new Error("Received unexpected parseComplete message from backend.");
				this._handleErrorEvent(error);
				return;
			}
			if (activeQuery.name) this.connection.parsedStatements[activeQuery.name] = activeQuery.text;
		}
		_handleCopyInResponse(msg) {
			const activeQuery = this._getActiveQuery();
			if (activeQuery == null) {
				const error = /* @__PURE__ */ new Error("Received unexpected copyInResponse message from backend.");
				this._handleErrorEvent(error);
				return;
			}
			activeQuery.handleCopyInResponse(this.connection);
		}
		_handleCopyData(msg) {
			const activeQuery = this._getActiveQuery();
			if (activeQuery == null) {
				const error = /* @__PURE__ */ new Error("Received unexpected copyData message from backend.");
				this._handleErrorEvent(error);
				return;
			}
			activeQuery.handleCopyData(msg, this.connection);
		}
		_handleNotification(msg) {
			this.emit("notification", msg);
		}
		_handleNotice(msg) {
			this.emit("notice", msg);
		}
		getStartupConf() {
			const params = this.connectionParameters;
			const data = {
				user: params.user,
				database: params.database
			};
			const appName = params.application_name || params.fallback_application_name;
			if (appName) data.application_name = appName;
			if (params.replication) data.replication = "" + params.replication;
			if (params.statement_timeout) data.statement_timeout = String(parseInt(params.statement_timeout, 10));
			if (params.lock_timeout) data.lock_timeout = String(parseInt(params.lock_timeout, 10));
			if (params.idle_in_transaction_session_timeout) data.idle_in_transaction_session_timeout = String(parseInt(params.idle_in_transaction_session_timeout, 10));
			if (params.options) data.options = params.options;
			return data;
		}
		cancel(client, query$1) {
			if (client.activeQuery === query$1) {
				const con = this.connection;
				if (this.host && this.host.indexOf("/") === 0) con.connect(this.host + "/.s.PGSQL." + this.port);
				else con.connect(this.port, this.host);
				con.on("connect", function() {
					con.cancel(client.processID, client.secretKey);
				});
			} else if (client._queryQueue.indexOf(query$1) !== -1) client._queryQueue.splice(client._queryQueue.indexOf(query$1), 1);
		}
		setTypeParser(oid, format, parseFn) {
			return this._types.setTypeParser(oid, format, parseFn);
		}
		getTypeParser(oid, format) {
			return this._types.getTypeParser(oid, format);
		}
		escapeIdentifier(str) {
			return utils$2.escapeIdentifier(str);
		}
		escapeLiteral(str) {
			return utils$2.escapeLiteral(str);
		}
		_pulseQueryQueue() {
			if (this.readyForQuery === true) {
				this._activeQuery = this._queryQueue.shift();
				const activeQuery = this._getActiveQuery();
				if (activeQuery) {
					this.readyForQuery = false;
					this.hasExecuted = true;
					const queryError = activeQuery.submit(this.connection);
					if (queryError) process.nextTick(() => {
						activeQuery.handleError(queryError, this.connection);
						this.readyForQuery = true;
						this._pulseQueryQueue();
					});
				} else if (this.hasExecuted) {
					this._activeQuery = null;
					this.emit("drain");
				}
			}
		}
		query(config, values, callback) {
			let query$1;
			let result;
			let readTimeout;
			let readTimeoutTimer;
			let queryCallback;
			if (config === null || config === void 0) throw new TypeError("Client was passed a null or undefined query");
			else if (typeof config.submit === "function") {
				readTimeout = config.query_timeout || this.connectionParameters.query_timeout;
				result = query$1 = config;
				if (!query$1.callback) {
					if (typeof values === "function") query$1.callback = values;
					else if (callback) query$1.callback = callback;
				}
			} else {
				readTimeout = config.query_timeout || this.connectionParameters.query_timeout;
				query$1 = new Query$1(config, values, callback);
				if (!query$1.callback) result = new this._Promise((resolve, reject) => {
					query$1.callback = (err, res) => err ? reject(err) : resolve(res);
				}).catch((err) => {
					Error.captureStackTrace(err);
					throw err;
				});
			}
			if (readTimeout) {
				queryCallback = query$1.callback || (() => {});
				readTimeoutTimer = setTimeout(() => {
					const error = /* @__PURE__ */ new Error("Query read timeout");
					process.nextTick(() => {
						query$1.handleError(error, this.connection);
					});
					queryCallback(error);
					query$1.callback = () => {};
					const index$1 = this._queryQueue.indexOf(query$1);
					if (index$1 > -1) this._queryQueue.splice(index$1, 1);
					this._pulseQueryQueue();
				}, readTimeout);
				query$1.callback = (err, res) => {
					clearTimeout(readTimeoutTimer);
					queryCallback(err, res);
				};
			}
			if (this.binary && !query$1.binary) query$1.binary = true;
			if (query$1._result && !query$1._result._types) query$1._result._types = this._types;
			if (!this._queryable) {
				process.nextTick(() => {
					query$1.handleError(/* @__PURE__ */ new Error("Client has encountered a connection error and is not queryable"), this.connection);
				});
				return result;
			}
			if (this._ending) {
				process.nextTick(() => {
					query$1.handleError(/* @__PURE__ */ new Error("Client was closed and is not queryable"), this.connection);
				});
				return result;
			}
			if (this._queryQueue.length > 0) queryQueueLengthDeprecationNotice$1();
			this._queryQueue.push(query$1);
			this._pulseQueryQueue();
			return result;
		}
		ref() {
			this.connection.ref();
		}
		unref() {
			this.connection.unref();
		}
		end(cb) {
			this._ending = true;
			if (!this.connection._connecting || this._ended) if (cb) cb();
			else return this._Promise.resolve();
			if (this._getActiveQuery() || !this._queryable) this.connection.stream.destroy();
			else this.connection.end();
			if (cb) this.connection.once("end", cb);
			else return new this._Promise((resolve) => {
				this.connection.once("end", resolve);
			});
		}
		get queryQueue() {
			queryQueueDeprecationNotice();
			return this._queryQueue;
		}
	};
	Client$3.Query = Query$1;
	module.exports = Client$3;
}));

//#endregion
//#region ../../node_modules/.bun/pg-pool@3.13.0+52bd52a0bccfa6a2/node_modules/pg-pool/index.js
var require_pg_pool = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const EventEmitter$2 = __require("events").EventEmitter;
	const NOOP = function() {};
	const removeWhere = (list, predicate) => {
		const i = list.findIndex(predicate);
		return i === -1 ? void 0 : list.splice(i, 1)[0];
	};
	var IdleItem = class {
		constructor(client, idleListener, timeoutId) {
			this.client = client;
			this.idleListener = idleListener;
			this.timeoutId = timeoutId;
		}
	};
	var PendingItem = class {
		constructor(callback) {
			this.callback = callback;
		}
	};
	function throwOnDoubleRelease() {
		throw new Error("Release called on client which has already been released to the pool.");
	}
	function promisify(Promise$1, callback) {
		if (callback) return {
			callback,
			result: void 0
		};
		let rej;
		let res;
		const cb = function(err, client) {
			err ? rej(err) : res(client);
		};
		return {
			callback: cb,
			result: new Promise$1(function(resolve, reject) {
				res = resolve;
				rej = reject;
			}).catch((err) => {
				Error.captureStackTrace(err);
				throw err;
			})
		};
	}
	function makeIdleListener(pool, client) {
		return function idleListener(err) {
			err.client = client;
			client.removeListener("error", idleListener);
			client.on("error", () => {
				pool.log("additional client error after disconnection due to error", err);
			});
			pool._remove(client);
			pool.emit("error", err, client);
		};
	}
	var Pool$3 = class extends EventEmitter$2 {
		constructor(options, Client$4) {
			super();
			this.options = Object.assign({}, options);
			if (options != null && "password" in options) Object.defineProperty(this.options, "password", {
				configurable: true,
				enumerable: false,
				writable: true,
				value: options.password
			});
			if (options != null && options.ssl && options.ssl.key) Object.defineProperty(this.options.ssl, "key", { enumerable: false });
			this.options.max = this.options.max || this.options.poolSize || 10;
			this.options.min = this.options.min || 0;
			this.options.maxUses = this.options.maxUses || Infinity;
			this.options.allowExitOnIdle = this.options.allowExitOnIdle || false;
			this.options.maxLifetimeSeconds = this.options.maxLifetimeSeconds || 0;
			this.log = this.options.log || function() {};
			this.Client = this.options.Client || Client$4 || require_lib().Client;
			this.Promise = this.options.Promise || global.Promise;
			if (typeof this.options.idleTimeoutMillis === "undefined") this.options.idleTimeoutMillis = 1e4;
			this._clients = [];
			this._idle = [];
			this._expired = /* @__PURE__ */ new WeakSet();
			this._pendingQueue = [];
			this._endCallback = void 0;
			this.ending = false;
			this.ended = false;
		}
		_promiseTry(f) {
			const Promise$1 = this.Promise;
			if (typeof Promise$1.try === "function") return Promise$1.try(f);
			return new Promise$1((resolve) => resolve(f()));
		}
		_isFull() {
			return this._clients.length >= this.options.max;
		}
		_isAboveMin() {
			return this._clients.length > this.options.min;
		}
		_pulseQueue() {
			this.log("pulse queue");
			if (this.ended) {
				this.log("pulse queue ended");
				return;
			}
			if (this.ending) {
				this.log("pulse queue on ending");
				if (this._idle.length) this._idle.slice().map((item) => {
					this._remove(item.client);
				});
				if (!this._clients.length) {
					this.ended = true;
					this._endCallback();
				}
				return;
			}
			if (!this._pendingQueue.length) {
				this.log("no queued requests");
				return;
			}
			if (!this._idle.length && this._isFull()) return;
			const pendingItem = this._pendingQueue.shift();
			if (this._idle.length) {
				const idleItem = this._idle.pop();
				clearTimeout(idleItem.timeoutId);
				const client = idleItem.client;
				client.ref && client.ref();
				const idleListener = idleItem.idleListener;
				return this._acquireClient(client, pendingItem, idleListener, false);
			}
			if (!this._isFull()) return this.newClient(pendingItem);
			throw new Error("unexpected condition");
		}
		_remove(client, callback) {
			const removed = removeWhere(this._idle, (item) => item.client === client);
			if (removed !== void 0) clearTimeout(removed.timeoutId);
			this._clients = this._clients.filter((c) => c !== client);
			const context = this;
			client.end(() => {
				context.emit("remove", client);
				if (typeof callback === "function") callback();
			});
		}
		connect(cb) {
			if (this.ending) {
				const err = /* @__PURE__ */ new Error("Cannot use a pool after calling end on the pool");
				return cb ? cb(err) : this.Promise.reject(err);
			}
			const response = promisify(this.Promise, cb);
			const result = response.result;
			if (this._isFull() || this._idle.length) {
				if (this._idle.length) process.nextTick(() => this._pulseQueue());
				if (!this.options.connectionTimeoutMillis) {
					this._pendingQueue.push(new PendingItem(response.callback));
					return result;
				}
				const queueCallback = (err, res, done) => {
					clearTimeout(tid);
					response.callback(err, res, done);
				};
				const pendingItem = new PendingItem(queueCallback);
				const tid = setTimeout(() => {
					removeWhere(this._pendingQueue, (i) => i.callback === queueCallback);
					pendingItem.timedOut = true;
					response.callback(/* @__PURE__ */ new Error("timeout exceeded when trying to connect"));
				}, this.options.connectionTimeoutMillis);
				if (tid.unref) tid.unref();
				this._pendingQueue.push(pendingItem);
				return result;
			}
			this.newClient(new PendingItem(response.callback));
			return result;
		}
		newClient(pendingItem) {
			const client = new this.Client(this.options);
			this._clients.push(client);
			const idleListener = makeIdleListener(this, client);
			this.log("checking client timeout");
			let tid;
			let timeoutHit = false;
			if (this.options.connectionTimeoutMillis) tid = setTimeout(() => {
				if (client.connection) {
					this.log("ending client due to timeout");
					timeoutHit = true;
					client.connection.stream.destroy();
				} else if (!client.isConnected()) {
					this.log("ending client due to timeout");
					timeoutHit = true;
					client.end();
				}
			}, this.options.connectionTimeoutMillis);
			this.log("connecting new client");
			client.connect((err) => {
				if (tid) clearTimeout(tid);
				client.on("error", idleListener);
				if (err) {
					this.log("client failed to connect", err);
					this._clients = this._clients.filter((c) => c !== client);
					if (timeoutHit) err = new Error("Connection terminated due to connection timeout", { cause: err });
					this._pulseQueue();
					if (!pendingItem.timedOut) pendingItem.callback(err, void 0, NOOP);
				} else {
					this.log("new client connected");
					if (this.options.onConnect) {
						this._promiseTry(() => this.options.onConnect(client)).then(() => {
							this._afterConnect(client, pendingItem, idleListener);
						}, (hookErr) => {
							this._clients = this._clients.filter((c) => c !== client);
							client.end(() => {
								this._pulseQueue();
								if (!pendingItem.timedOut) pendingItem.callback(hookErr, void 0, NOOP);
							});
						});
						return;
					}
					return this._afterConnect(client, pendingItem, idleListener);
				}
			});
		}
		_afterConnect(client, pendingItem, idleListener) {
			if (this.options.maxLifetimeSeconds !== 0) {
				const maxLifetimeTimeout = setTimeout(() => {
					this.log("ending client due to expired lifetime");
					this._expired.add(client);
					if (this._idle.findIndex((idleItem) => idleItem.client === client) !== -1) this._acquireClient(client, new PendingItem((err, client$1, clientRelease) => clientRelease()), idleListener, false);
				}, this.options.maxLifetimeSeconds * 1e3);
				maxLifetimeTimeout.unref();
				client.once("end", () => clearTimeout(maxLifetimeTimeout));
			}
			return this._acquireClient(client, pendingItem, idleListener, true);
		}
		_acquireClient(client, pendingItem, idleListener, isNew) {
			if (isNew) this.emit("connect", client);
			this.emit("acquire", client);
			client.release = this._releaseOnce(client, idleListener);
			client.removeListener("error", idleListener);
			if (!pendingItem.timedOut) if (isNew && this.options.verify) this.options.verify(client, (err) => {
				if (err) {
					client.release(err);
					return pendingItem.callback(err, void 0, NOOP);
				}
				pendingItem.callback(void 0, client, client.release);
			});
			else pendingItem.callback(void 0, client, client.release);
			else if (isNew && this.options.verify) this.options.verify(client, client.release);
			else client.release();
		}
		_releaseOnce(client, idleListener) {
			let released = false;
			return (err) => {
				if (released) throwOnDoubleRelease();
				released = true;
				this._release(client, idleListener, err);
			};
		}
		_release(client, idleListener, err) {
			client.on("error", idleListener);
			client._poolUseCount = (client._poolUseCount || 0) + 1;
			this.emit("release", err, client);
			if (err || this.ending || !client._queryable || client._ending || client._poolUseCount >= this.options.maxUses) {
				if (client._poolUseCount >= this.options.maxUses) this.log("remove expended client");
				return this._remove(client, this._pulseQueue.bind(this));
			}
			if (this._expired.has(client)) {
				this.log("remove expired client");
				this._expired.delete(client);
				return this._remove(client, this._pulseQueue.bind(this));
			}
			let tid;
			if (this.options.idleTimeoutMillis && this._isAboveMin()) {
				tid = setTimeout(() => {
					if (this._isAboveMin()) {
						this.log("remove idle client");
						this._remove(client, this._pulseQueue.bind(this));
					}
				}, this.options.idleTimeoutMillis);
				if (this.options.allowExitOnIdle) tid.unref();
			}
			if (this.options.allowExitOnIdle) client.unref();
			this._idle.push(new IdleItem(client, idleListener, tid));
			this._pulseQueue();
		}
		query(text$1, values, cb) {
			if (typeof text$1 === "function") {
				const response$1 = promisify(this.Promise, text$1);
				setImmediate(function() {
					return response$1.callback(/* @__PURE__ */ new Error("Passing a function as the first parameter to pool.query is not supported"));
				});
				return response$1.result;
			}
			if (typeof values === "function") {
				cb = values;
				values = void 0;
			}
			const response = promisify(this.Promise, cb);
			cb = response.callback;
			this.connect((err, client) => {
				if (err) return cb(err);
				let clientReleased = false;
				const onError$1 = (err$1) => {
					if (clientReleased) return;
					clientReleased = true;
					client.release(err$1);
					cb(err$1);
				};
				client.once("error", onError$1);
				this.log("dispatching query");
				try {
					client.query(text$1, values, (err$1, res) => {
						this.log("query dispatched");
						client.removeListener("error", onError$1);
						if (clientReleased) return;
						clientReleased = true;
						client.release(err$1);
						if (err$1) return cb(err$1);
						return cb(void 0, res);
					});
				} catch (err$1) {
					client.release(err$1);
					return cb(err$1);
				}
			});
			return response.result;
		}
		end(cb) {
			this.log("ending");
			if (this.ending) {
				const err = /* @__PURE__ */ new Error("Called end on pool more than once");
				return cb ? cb(err) : this.Promise.reject(err);
			}
			this.ending = true;
			const promised = promisify(this.Promise, cb);
			this._endCallback = promised.callback;
			this._pulseQueue();
			return promised.result;
		}
		get waitingCount() {
			return this._pendingQueue.length;
		}
		get idleCount() {
			return this._idle.length;
		}
		get expiredCount() {
			return this._clients.reduce((acc, client) => acc + (this._expired.has(client) ? 1 : 0), 0);
		}
		get totalCount() {
			return this._clients.length;
		}
	};
	module.exports = Pool$3;
}));

//#endregion
//#region ../../node_modules/.bun/pg@8.20.0+52bd52a0bccfa6a2/node_modules/pg/lib/native/query.js
var require_query = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const EventEmitter$1 = __require("events").EventEmitter;
	const util$1 = __require("util");
	const utils$1 = require_utils$1();
	const NativeQuery$1 = module.exports = function(config, values, callback) {
		EventEmitter$1.call(this);
		config = utils$1.normalizeQueryConfig(config, values, callback);
		this.text = config.text;
		this.values = config.values;
		this.name = config.name;
		this.queryMode = config.queryMode;
		this.callback = config.callback;
		this.state = "new";
		this._arrayMode = config.rowMode === "array";
		this._emitRowEvents = false;
		this.on("newListener", function(event) {
			if (event === "row") this._emitRowEvents = true;
		}.bind(this));
	};
	util$1.inherits(NativeQuery$1, EventEmitter$1);
	const errorFieldMap = {
		sqlState: "code",
		statementPosition: "position",
		messagePrimary: "message",
		context: "where",
		schemaName: "schema",
		tableName: "table",
		columnName: "column",
		dataTypeName: "dataType",
		constraintName: "constraint",
		sourceFile: "file",
		sourceLine: "line",
		sourceFunction: "routine"
	};
	NativeQuery$1.prototype.handleError = function(err) {
		const fields = this.native.pq.resultErrorFields();
		if (fields) for (const key in fields) {
			const normalizedFieldName = errorFieldMap[key] || key;
			err[normalizedFieldName] = fields[key];
		}
		if (this.callback) this.callback(err);
		else this.emit("error", err);
		this.state = "error";
	};
	NativeQuery$1.prototype.then = function(onSuccess, onFailure) {
		return this._getPromise().then(onSuccess, onFailure);
	};
	NativeQuery$1.prototype.catch = function(callback) {
		return this._getPromise().catch(callback);
	};
	NativeQuery$1.prototype._getPromise = function() {
		if (this._promise) return this._promise;
		this._promise = new Promise(function(resolve, reject) {
			this._once("end", resolve);
			this._once("error", reject);
		}.bind(this));
		return this._promise;
	};
	NativeQuery$1.prototype.submit = function(client) {
		this.state = "running";
		const self = this;
		this.native = client.native;
		client.native.arrayMode = this._arrayMode;
		let after = function(err, rows, results) {
			client.native.arrayMode = false;
			setImmediate(function() {
				self.emit("_done");
			});
			if (err) return self.handleError(err);
			if (self._emitRowEvents) if (results.length > 1) rows.forEach((rowOfRows, i) => {
				rowOfRows.forEach((row) => {
					self.emit("row", row, results[i]);
				});
			});
			else rows.forEach(function(row) {
				self.emit("row", row, results);
			});
			self.state = "end";
			self.emit("end", results);
			if (self.callback) self.callback(null, results);
		};
		if (process.domain) after = process.domain.bind(after);
		if (this.name) {
			if (this.name.length > 63) {
				console.error("Warning! Postgres only supports 63 characters for query names.");
				console.error("You supplied %s (%s)", this.name, this.name.length);
				console.error("This can cause conflicts and silent errors executing queries");
			}
			const values = (this.values || []).map(utils$1.prepareValue);
			if (client.namedQueries[this.name]) {
				if (this.text && client.namedQueries[this.name] !== this.text) {
					const err = /* @__PURE__ */ new Error(`Prepared statements must be unique - '${this.name}' was used for a different statement`);
					return after(err);
				}
				return client.native.execute(this.name, values, after);
			}
			return client.native.prepare(this.name, this.text, values.length, function(err) {
				if (err) return after(err);
				client.namedQueries[self.name] = self.text;
				return self.native.execute(self.name, values, after);
			});
		} else if (this.values) {
			if (!Array.isArray(this.values)) return after(/* @__PURE__ */ new Error("Query values must be an array"));
			const vals = this.values.map(utils$1.prepareValue);
			client.native.query(this.text, vals, after);
		} else if (this.queryMode === "extended") client.native.query(this.text, [], after);
		else client.native.query(this.text, after);
	};
}));

//#endregion
//#region ../../node_modules/.bun/pg@8.20.0+52bd52a0bccfa6a2/node_modules/pg/lib/native/client.js
var require_client = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const nodeUtils = __require("util");
	var Native;
	try {
		Native = __require("pg-native");
	} catch (e) {
		throw e;
	}
	const TypeOverrides$2 = require_type_overrides();
	const EventEmitter = __require("events").EventEmitter;
	const util = __require("util");
	const ConnectionParameters = require_connection_parameters();
	const NativeQuery = require_query();
	const queryQueueLengthDeprecationNotice = nodeUtils.deprecate(() => {}, "Calling client.query() when the client is already executing a query is deprecated and will be removed in pg@9.0. Use async/await or an external async flow control mechanism instead.");
	const Client$2 = module.exports = function(config) {
		EventEmitter.call(this);
		config = config || {};
		this._Promise = config.Promise || global.Promise;
		this._types = new TypeOverrides$2(config.types);
		this.native = new Native({ types: this._types });
		this._queryQueue = [];
		this._ending = false;
		this._connecting = false;
		this._connected = false;
		this._queryable = true;
		const cp = this.connectionParameters = new ConnectionParameters(config);
		if (config.nativeConnectionString) cp.nativeConnectionString = config.nativeConnectionString;
		this.user = cp.user;
		Object.defineProperty(this, "password", {
			configurable: true,
			enumerable: false,
			writable: true,
			value: cp.password
		});
		this.database = cp.database;
		this.host = cp.host;
		this.port = cp.port;
		this.namedQueries = {};
	};
	Client$2.Query = NativeQuery;
	util.inherits(Client$2, EventEmitter);
	Client$2.prototype._errorAllQueries = function(err) {
		const enqueueError = (query$1) => {
			process.nextTick(() => {
				query$1.native = this.native;
				query$1.handleError(err);
			});
		};
		if (this._hasActiveQuery()) {
			enqueueError(this._activeQuery);
			this._activeQuery = null;
		}
		this._queryQueue.forEach(enqueueError);
		this._queryQueue.length = 0;
	};
	Client$2.prototype._connect = function(cb) {
		const self = this;
		if (this._connecting) {
			process.nextTick(() => cb(/* @__PURE__ */ new Error("Client has already been connected. You cannot reuse a client.")));
			return;
		}
		this._connecting = true;
		this.connectionParameters.getLibpqConnectionString(function(err, conString) {
			if (self.connectionParameters.nativeConnectionString) conString = self.connectionParameters.nativeConnectionString;
			if (err) return cb(err);
			self.native.connect(conString, function(err$1) {
				if (err$1) {
					self.native.end();
					return cb(err$1);
				}
				self._connected = true;
				self.native.on("error", function(err$2) {
					self._queryable = false;
					self._errorAllQueries(err$2);
					self.emit("error", err$2);
				});
				self.native.on("notification", function(msg) {
					self.emit("notification", {
						channel: msg.relname,
						payload: msg.extra
					});
				});
				self.emit("connect");
				self._pulseQueryQueue(true);
				cb(null, this);
			});
		});
	};
	Client$2.prototype.connect = function(callback) {
		if (callback) {
			this._connect(callback);
			return;
		}
		return new this._Promise((resolve, reject) => {
			this._connect((error) => {
				if (error) reject(error);
				else resolve(this);
			});
		});
	};
	Client$2.prototype.query = function(config, values, callback) {
		let query$1;
		let result;
		let readTimeout;
		let readTimeoutTimer;
		let queryCallback;
		if (config === null || config === void 0) throw new TypeError("Client was passed a null or undefined query");
		else if (typeof config.submit === "function") {
			readTimeout = config.query_timeout || this.connectionParameters.query_timeout;
			result = query$1 = config;
			if (typeof values === "function") config.callback = values;
		} else {
			readTimeout = config.query_timeout || this.connectionParameters.query_timeout;
			query$1 = new NativeQuery(config, values, callback);
			if (!query$1.callback) {
				let resolveOut, rejectOut;
				result = new this._Promise((resolve, reject) => {
					resolveOut = resolve;
					rejectOut = reject;
				}).catch((err) => {
					Error.captureStackTrace(err);
					throw err;
				});
				query$1.callback = (err, res) => err ? rejectOut(err) : resolveOut(res);
			}
		}
		if (readTimeout) {
			queryCallback = query$1.callback || (() => {});
			readTimeoutTimer = setTimeout(() => {
				const error = /* @__PURE__ */ new Error("Query read timeout");
				process.nextTick(() => {
					query$1.handleError(error, this.connection);
				});
				queryCallback(error);
				query$1.callback = () => {};
				const index$1 = this._queryQueue.indexOf(query$1);
				if (index$1 > -1) this._queryQueue.splice(index$1, 1);
				this._pulseQueryQueue();
			}, readTimeout);
			query$1.callback = (err, res) => {
				clearTimeout(readTimeoutTimer);
				queryCallback(err, res);
			};
		}
		if (!this._queryable) {
			query$1.native = this.native;
			process.nextTick(() => {
				query$1.handleError(/* @__PURE__ */ new Error("Client has encountered a connection error and is not queryable"));
			});
			return result;
		}
		if (this._ending) {
			query$1.native = this.native;
			process.nextTick(() => {
				query$1.handleError(/* @__PURE__ */ new Error("Client was closed and is not queryable"));
			});
			return result;
		}
		if (this._queryQueue.length > 0) queryQueueLengthDeprecationNotice();
		this._queryQueue.push(query$1);
		this._pulseQueryQueue();
		return result;
	};
	Client$2.prototype.end = function(cb) {
		const self = this;
		this._ending = true;
		if (!this._connected) this.once("connect", this.end.bind(this, cb));
		let result;
		if (!cb) result = new this._Promise(function(resolve, reject) {
			cb = (err) => err ? reject(err) : resolve();
		});
		this.native.end(function() {
			self._connected = false;
			self._errorAllQueries(/* @__PURE__ */ new Error("Connection terminated"));
			process.nextTick(() => {
				self.emit("end");
				if (cb) cb();
			});
		});
		return result;
	};
	Client$2.prototype._hasActiveQuery = function() {
		return this._activeQuery && this._activeQuery.state !== "error" && this._activeQuery.state !== "end";
	};
	Client$2.prototype._pulseQueryQueue = function(initialConnection) {
		if (!this._connected) return;
		if (this._hasActiveQuery()) return;
		const query$1 = this._queryQueue.shift();
		if (!query$1) {
			if (!initialConnection) this.emit("drain");
			return;
		}
		this._activeQuery = query$1;
		query$1.submit(this);
		const self = this;
		query$1.once("_done", function() {
			self._pulseQueryQueue();
		});
	};
	Client$2.prototype.cancel = function(query$1) {
		if (this._activeQuery === query$1) this.native.cancel(function() {});
		else if (this._queryQueue.indexOf(query$1) !== -1) this._queryQueue.splice(this._queryQueue.indexOf(query$1), 1);
	};
	Client$2.prototype.ref = function() {};
	Client$2.prototype.unref = function() {};
	Client$2.prototype.setTypeParser = function(oid, format, parseFn) {
		return this._types.setTypeParser(oid, format, parseFn);
	};
	Client$2.prototype.getTypeParser = function(oid, format) {
		return this._types.getTypeParser(oid, format);
	};
	Client$2.prototype.isConnected = function() {
		return this._connected;
	};
}));

//#endregion
//#region ../../node_modules/.bun/pg@8.20.0+52bd52a0bccfa6a2/node_modules/pg/lib/native/index.js
var require_native = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = require_client();
}));

//#endregion
//#region ../../node_modules/.bun/pg@8.20.0+52bd52a0bccfa6a2/node_modules/pg/lib/index.js
var require_lib = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const Client$1 = require_client$1();
	const defaults$1 = require_defaults();
	const Connection$1 = require_connection();
	const Result$1 = require_result();
	const utils = require_utils$1();
	const Pool$2 = require_pg_pool();
	const TypeOverrides$1 = require_type_overrides();
	const { DatabaseError: DatabaseError$1 } = require_dist();
	const { escapeIdentifier: escapeIdentifier$1, escapeLiteral: escapeLiteral$1 } = require_utils$1();
	const poolFactory = (Client$4) => {
		return class BoundPool extends Pool$2 {
			constructor(options) {
				super(options, Client$4);
			}
		};
	};
	const PG = function(clientConstructor$1) {
		this.defaults = defaults$1;
		this.Client = clientConstructor$1;
		this.Query = this.Client.Query;
		this.Pool = poolFactory(this.Client);
		this._pools = [];
		this.Connection = Connection$1;
		this.types = require_pg_types();
		this.DatabaseError = DatabaseError$1;
		this.TypeOverrides = TypeOverrides$1;
		this.escapeIdentifier = escapeIdentifier$1;
		this.escapeLiteral = escapeLiteral$1;
		this.Result = Result$1;
		this.utils = utils;
	};
	let clientConstructor = Client$1;
	let forceNative = false;
	try {
		forceNative = !!process.env.NODE_PG_FORCE_NATIVE;
	} catch {}
	if (forceNative) clientConstructor = require_native();
	module.exports = new PG(clientConstructor);
	Object.defineProperty(module.exports, "native", {
		configurable: true,
		enumerable: false,
		get() {
			let native = null;
			try {
				native = new PG(require_native());
			} catch (err) {
				if (err.code !== "MODULE_NOT_FOUND") throw err;
			}
			Object.defineProperty(module.exports, "native", { value: native });
			return native;
		}
	});
}));

//#endregion
//#region ../../node_modules/.bun/pg@8.20.0+52bd52a0bccfa6a2/node_modules/pg/esm/index.mjs
var import_lib = /* @__PURE__ */ __toESM(require_lib(), 1);
const Client = import_lib.default.Client;
const Pool$1 = import_lib.default.Pool;
const Connection = import_lib.default.Connection;
const types$1 = import_lib.default.types;
const Query = import_lib.default.Query;
const DatabaseError = import_lib.default.DatabaseError;
const escapeIdentifier = import_lib.default.escapeIdentifier;
const escapeLiteral = import_lib.default.escapeLiteral;
const Result = import_lib.default.Result;
const TypeOverrides = import_lib.default.TypeOverrides;
const defaults = import_lib.default.defaults;
var esm_default = import_lib.default;

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/entity.js
const entityKind = Symbol.for("drizzle:entityKind");
const hasOwnEntityKind = Symbol.for("drizzle:hasOwnEntityKind");
function is(value, type) {
	if (!value || typeof value !== "object") return false;
	if (value instanceof type) return true;
	if (!Object.prototype.hasOwnProperty.call(type, entityKind)) throw new Error(`Class "${type.name ?? "<unknown>"}" doesn't look like a Drizzle entity. If this is incorrect and the class is provided by Drizzle, please report this as a bug.`);
	let cls = Object.getPrototypeOf(value).constructor;
	if (cls) while (cls) {
		if (entityKind in cls && cls[entityKind] === type[entityKind]) return true;
		cls = Object.getPrototypeOf(cls);
	}
	return false;
}

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/logger.js
var ConsoleLogWriter = class {
	static [entityKind] = "ConsoleLogWriter";
	write(message) {
		console.log(message);
	}
};
var DefaultLogger = class {
	static [entityKind] = "DefaultLogger";
	writer;
	constructor(config) {
		this.writer = config?.writer ?? new ConsoleLogWriter();
	}
	logQuery(query$1, params) {
		const stringifiedParams = params.map((p) => {
			try {
				return JSON.stringify(p);
			} catch {
				return String(p);
			}
		});
		const paramsStr = stringifiedParams.length ? ` -- params: [${stringifiedParams.join(", ")}]` : "";
		this.writer.write(`Query: ${query$1}${paramsStr}`);
	}
};
var NoopLogger = class {
	static [entityKind] = "NoopLogger";
	logQuery() {}
};

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/query-promise.js
var QueryPromise = class {
	static [entityKind] = "QueryPromise";
	[Symbol.toStringTag] = "QueryPromise";
	catch(onRejected) {
		return this.then(void 0, onRejected);
	}
	finally(onFinally) {
		return this.then((value) => {
			onFinally?.();
			return value;
		}, (reason) => {
			onFinally?.();
			throw reason;
		});
	}
	then(onFulfilled, onRejected) {
		return this.execute().then(onFulfilled, onRejected);
	}
};

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/column.js
var Column = class {
	constructor(table, config) {
		this.table = table;
		this.config = config;
		this.name = config.name;
		this.keyAsName = config.keyAsName;
		this.notNull = config.notNull;
		this.default = config.default;
		this.defaultFn = config.defaultFn;
		this.onUpdateFn = config.onUpdateFn;
		this.hasDefault = config.hasDefault;
		this.primary = config.primaryKey;
		this.isUnique = config.isUnique;
		this.uniqueName = config.uniqueName;
		this.uniqueType = config.uniqueType;
		this.dataType = config.dataType;
		this.columnType = config.columnType;
		this.generated = config.generated;
		this.generatedIdentity = config.generatedIdentity;
	}
	static [entityKind] = "Column";
	name;
	keyAsName;
	primary;
	notNull;
	default;
	defaultFn;
	onUpdateFn;
	hasDefault;
	isUnique;
	uniqueName;
	uniqueType;
	dataType;
	columnType;
	enumValues = void 0;
	generated = void 0;
	generatedIdentity = void 0;
	config;
	mapFromDriverValue(value) {
		return value;
	}
	mapToDriverValue(value) {
		return value;
	}
	shouldDisableInsert() {
		return this.config.generated !== void 0 && this.config.generated.type !== "byDefault";
	}
};

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/column-builder.js
var ColumnBuilder = class {
	static [entityKind] = "ColumnBuilder";
	config;
	constructor(name, dataType, columnType) {
		this.config = {
			name,
			keyAsName: name === "",
			notNull: false,
			default: void 0,
			hasDefault: false,
			primaryKey: false,
			isUnique: false,
			uniqueName: void 0,
			uniqueType: void 0,
			dataType,
			columnType,
			generated: void 0
		};
	}
	/**
	* Changes the data type of the column. Commonly used with `json` columns. Also, useful for branded types.
	*
	* @example
	* ```ts
	* const users = pgTable('users', {
	* 	id: integer('id').$type<UserId>().primaryKey(),
	* 	details: json('details').$type<UserDetails>().notNull(),
	* });
	* ```
	*/
	$type() {
		return this;
	}
	/**
	* Adds a `not null` clause to the column definition.
	*
	* Affects the `select` model of the table - columns *without* `not null` will be nullable on select.
	*/
	notNull() {
		this.config.notNull = true;
		return this;
	}
	/**
	* Adds a `default <value>` clause to the column definition.
	*
	* Affects the `insert` model of the table - columns *with* `default` are optional on insert.
	*
	* If you need to set a dynamic default value, use {@link $defaultFn} instead.
	*/
	default(value) {
		this.config.default = value;
		this.config.hasDefault = true;
		return this;
	}
	/**
	* Adds a dynamic default value to the column.
	* The function will be called when the row is inserted, and the returned value will be used as the column value.
	*
	* **Note:** This value does not affect the `drizzle-kit` behavior, it is only used at runtime in `drizzle-orm`.
	*/
	$defaultFn(fn) {
		this.config.defaultFn = fn;
		this.config.hasDefault = true;
		return this;
	}
	/**
	* Alias for {@link $defaultFn}.
	*/
	$default = this.$defaultFn;
	/**
	* Adds a dynamic update value to the column.
	* The function will be called when the row is updated, and the returned value will be used as the column value if none is provided.
	* If no `default` (or `$defaultFn`) value is provided, the function will be called when the row is inserted as well, and the returned value will be used as the column value.
	*
	* **Note:** This value does not affect the `drizzle-kit` behavior, it is only used at runtime in `drizzle-orm`.
	*/
	$onUpdateFn(fn) {
		this.config.onUpdateFn = fn;
		this.config.hasDefault = true;
		return this;
	}
	/**
	* Alias for {@link $onUpdateFn}.
	*/
	$onUpdate = this.$onUpdateFn;
	/**
	* Adds a `primary key` clause to the column definition. This implicitly makes the column `not null`.
	*
	* In SQLite, `integer primary key` implicitly makes the column auto-incrementing.
	*/
	primaryKey() {
		this.config.primaryKey = true;
		this.config.notNull = true;
		return this;
	}
	/** @internal Sets the name of the column to the key within the table definition if a name was not given. */
	setName(name) {
		if (this.config.name !== "") return;
		this.config.name = name;
	}
};

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/table.utils.js
const TableName = Symbol.for("drizzle:Name");

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/pg-core/foreign-keys.js
var ForeignKeyBuilder = class {
	static [entityKind] = "PgForeignKeyBuilder";
	/** @internal */
	reference;
	/** @internal */
	_onUpdate = "no action";
	/** @internal */
	_onDelete = "no action";
	constructor(config, actions) {
		this.reference = () => {
			const { name, columns, foreignColumns } = config();
			return {
				name,
				columns,
				foreignTable: foreignColumns[0].table,
				foreignColumns
			};
		};
		if (actions) {
			this._onUpdate = actions.onUpdate;
			this._onDelete = actions.onDelete;
		}
	}
	onUpdate(action) {
		this._onUpdate = action === void 0 ? "no action" : action;
		return this;
	}
	onDelete(action) {
		this._onDelete = action === void 0 ? "no action" : action;
		return this;
	}
	/** @internal */
	build(table) {
		return new ForeignKey(table, this);
	}
};
var ForeignKey = class {
	constructor(table, builder) {
		this.table = table;
		this.reference = builder.reference;
		this.onUpdate = builder._onUpdate;
		this.onDelete = builder._onDelete;
	}
	static [entityKind] = "PgForeignKey";
	reference;
	onUpdate;
	onDelete;
	getName() {
		const { name, columns, foreignColumns } = this.reference();
		const columnNames = columns.map((column) => column.name);
		const foreignColumnNames = foreignColumns.map((column) => column.name);
		const chunks = [
			this.table[TableName],
			...columnNames,
			foreignColumns[0].table[TableName],
			...foreignColumnNames
		];
		return name ?? `${chunks.join("_")}_fk`;
	}
};

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/tracing-utils.js
function iife(fn, ...args) {
	return fn(...args);
}

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/pg-core/unique-constraint.js
function uniqueKeyName(table, columns) {
	return `${table[TableName]}_${columns.join("_")}_unique`;
}
var UniqueConstraintBuilder = class {
	constructor(columns, name) {
		this.name = name;
		this.columns = columns;
	}
	static [entityKind] = "PgUniqueConstraintBuilder";
	/** @internal */
	columns;
	/** @internal */
	nullsNotDistinctConfig = false;
	nullsNotDistinct() {
		this.nullsNotDistinctConfig = true;
		return this;
	}
	/** @internal */
	build(table) {
		return new UniqueConstraint(table, this.columns, this.nullsNotDistinctConfig, this.name);
	}
};
var UniqueOnConstraintBuilder = class {
	static [entityKind] = "PgUniqueOnConstraintBuilder";
	/** @internal */
	name;
	constructor(name) {
		this.name = name;
	}
	on(...columns) {
		return new UniqueConstraintBuilder(columns, this.name);
	}
};
var UniqueConstraint = class {
	constructor(table, columns, nullsNotDistinct, name) {
		this.table = table;
		this.columns = columns;
		this.name = name ?? uniqueKeyName(this.table, this.columns.map((column) => column.name));
		this.nullsNotDistinct = nullsNotDistinct;
	}
	static [entityKind] = "PgUniqueConstraint";
	columns;
	name;
	nullsNotDistinct = false;
	getName() {
		return this.name;
	}
};

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/pg-core/utils/array.js
function parsePgArrayValue(arrayString$1, startFrom, inQuotes) {
	for (let i = startFrom; i < arrayString$1.length; i++) {
		const char$1 = arrayString$1[i];
		if (char$1 === "\\") {
			i++;
			continue;
		}
		if (char$1 === "\"") return [arrayString$1.slice(startFrom, i).replace(/\\/g, ""), i + 1];
		if (inQuotes) continue;
		if (char$1 === "," || char$1 === "}") return [arrayString$1.slice(startFrom, i).replace(/\\/g, ""), i];
	}
	return [arrayString$1.slice(startFrom).replace(/\\/g, ""), arrayString$1.length];
}
function parsePgNestedArray(arrayString$1, startFrom = 0) {
	const result = [];
	let i = startFrom;
	let lastCharIsComma = false;
	while (i < arrayString$1.length) {
		const char$1 = arrayString$1[i];
		if (char$1 === ",") {
			if (lastCharIsComma || i === startFrom) result.push("");
			lastCharIsComma = true;
			i++;
			continue;
		}
		lastCharIsComma = false;
		if (char$1 === "\\") {
			i += 2;
			continue;
		}
		if (char$1 === "\"") {
			const [value2, startFrom2] = parsePgArrayValue(arrayString$1, i + 1, true);
			result.push(value2);
			i = startFrom2;
			continue;
		}
		if (char$1 === "}") return [result, i + 1];
		if (char$1 === "{") {
			const [value2, startFrom2] = parsePgNestedArray(arrayString$1, i + 1);
			result.push(value2);
			i = startFrom2;
			continue;
		}
		const [value, newStartFrom] = parsePgArrayValue(arrayString$1, i, false);
		result.push(value);
		i = newStartFrom;
	}
	return [result, i];
}
function parsePgArray(arrayString$1) {
	const [result] = parsePgNestedArray(arrayString$1, 1);
	return result;
}
function makePgArray(array$2) {
	return `{${array$2.map((item) => {
		if (Array.isArray(item)) return makePgArray(item);
		if (typeof item === "string") return `"${item.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"`;
		return `${item}`;
	}).join(",")}}`;
}

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/pg-core/columns/common.js
var PgColumnBuilder = class extends ColumnBuilder {
	foreignKeyConfigs = [];
	static [entityKind] = "PgColumnBuilder";
	array(size) {
		return new PgArrayBuilder(this.config.name, this, size);
	}
	references(ref, actions = {}) {
		this.foreignKeyConfigs.push({
			ref,
			actions
		});
		return this;
	}
	unique(name, config) {
		this.config.isUnique = true;
		this.config.uniqueName = name;
		this.config.uniqueType = config?.nulls;
		return this;
	}
	generatedAlwaysAs(as) {
		this.config.generated = {
			as,
			type: "always",
			mode: "stored"
		};
		return this;
	}
	/** @internal */
	buildForeignKeys(column, table) {
		return this.foreignKeyConfigs.map(({ ref, actions }) => {
			return iife((ref2, actions2) => {
				const builder = new ForeignKeyBuilder(() => {
					const foreignColumn = ref2();
					return {
						columns: [column],
						foreignColumns: [foreignColumn]
					};
				});
				if (actions2.onUpdate) builder.onUpdate(actions2.onUpdate);
				if (actions2.onDelete) builder.onDelete(actions2.onDelete);
				return builder.build(table);
			}, ref, actions);
		});
	}
	/** @internal */
	buildExtraConfigColumn(table) {
		return new ExtraConfigColumn(table, this.config);
	}
};
var PgColumn = class extends Column {
	constructor(table, config) {
		if (!config.uniqueName) config.uniqueName = uniqueKeyName(table, [config.name]);
		super(table, config);
		this.table = table;
	}
	static [entityKind] = "PgColumn";
};
var ExtraConfigColumn = class extends PgColumn {
	static [entityKind] = "ExtraConfigColumn";
	getSQLType() {
		return this.getSQLType();
	}
	indexConfig = {
		order: this.config.order ?? "asc",
		nulls: this.config.nulls ?? "last",
		opClass: this.config.opClass
	};
	defaultConfig = {
		order: "asc",
		nulls: "last",
		opClass: void 0
	};
	asc() {
		this.indexConfig.order = "asc";
		return this;
	}
	desc() {
		this.indexConfig.order = "desc";
		return this;
	}
	nullsFirst() {
		this.indexConfig.nulls = "first";
		return this;
	}
	nullsLast() {
		this.indexConfig.nulls = "last";
		return this;
	}
	/**
	* ### PostgreSQL documentation quote
	*
	* > An operator class with optional parameters can be specified for each column of an index.
	* The operator class identifies the operators to be used by the index for that column.
	* For example, a B-tree index on four-byte integers would use the int4_ops class;
	* this operator class includes comparison functions for four-byte integers.
	* In practice the default operator class for the column's data type is usually sufficient.
	* The main point of having operator classes is that for some data types, there could be more than one meaningful ordering.
	* For example, we might want to sort a complex-number data type either by absolute value or by real part.
	* We could do this by defining two operator classes for the data type and then selecting the proper class when creating an index.
	* More information about operator classes check:
	*
	* ### Useful links
	* https://www.postgresql.org/docs/current/sql-createindex.html
	*
	* https://www.postgresql.org/docs/current/indexes-opclass.html
	*
	* https://www.postgresql.org/docs/current/xindex.html
	*
	* ### Additional types
	* If you have the `pg_vector` extension installed in your database, you can use the
	* `vector_l2_ops`, `vector_ip_ops`, `vector_cosine_ops`, `vector_l1_ops`, `bit_hamming_ops`, `bit_jaccard_ops`, `halfvec_l2_ops`, `sparsevec_l2_ops` options, which are predefined types.
	*
	* **You can always specify any string you want in the operator class, in case Drizzle doesn't have it natively in its types**
	*
	* @param opClass
	* @returns
	*/
	op(opClass) {
		this.indexConfig.opClass = opClass;
		return this;
	}
};
var IndexedColumn = class {
	static [entityKind] = "IndexedColumn";
	constructor(name, keyAsName, type, indexConfig) {
		this.name = name;
		this.keyAsName = keyAsName;
		this.type = type;
		this.indexConfig = indexConfig;
	}
	name;
	keyAsName;
	type;
	indexConfig;
};
var PgArrayBuilder = class extends PgColumnBuilder {
	static [entityKind] = "PgArrayBuilder";
	constructor(name, baseBuilder, size) {
		super(name, "array", "PgArray");
		this.config.baseBuilder = baseBuilder;
		this.config.size = size;
	}
	/** @internal */
	build(table) {
		const baseColumn = this.config.baseBuilder.build(table);
		return new PgArray(table, this.config, baseColumn);
	}
};
var PgArray = class PgArray extends PgColumn {
	constructor(table, config, baseColumn, range) {
		super(table, config);
		this.baseColumn = baseColumn;
		this.range = range;
		this.size = config.size;
	}
	size;
	static [entityKind] = "PgArray";
	getSQLType() {
		return `${this.baseColumn.getSQLType()}[${typeof this.size === "number" ? this.size : ""}]`;
	}
	mapFromDriverValue(value) {
		if (typeof value === "string") value = parsePgArray(value);
		return value.map((v) => this.baseColumn.mapFromDriverValue(v));
	}
	mapToDriverValue(value, isNestedArray = false) {
		const a = value.map((v) => v === null ? null : is(this.baseColumn, PgArray) ? this.baseColumn.mapToDriverValue(v, true) : this.baseColumn.mapToDriverValue(v));
		if (isNestedArray) return a;
		return makePgArray(a);
	}
};

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/pg-core/columns/enum.js
var PgEnumObjectColumnBuilder = class extends PgColumnBuilder {
	static [entityKind] = "PgEnumObjectColumnBuilder";
	constructor(name, enumInstance) {
		super(name, "string", "PgEnumObjectColumn");
		this.config.enum = enumInstance;
	}
	/** @internal */
	build(table) {
		return new PgEnumObjectColumn(table, this.config);
	}
};
var PgEnumObjectColumn = class extends PgColumn {
	static [entityKind] = "PgEnumObjectColumn";
	enum;
	enumValues = this.config.enum.enumValues;
	constructor(table, config) {
		super(table, config);
		this.enum = config.enum;
	}
	getSQLType() {
		return this.enum.enumName;
	}
};
const isPgEnumSym = Symbol.for("drizzle:isPgEnum");
function isPgEnum(obj) {
	return !!obj && typeof obj === "function" && isPgEnumSym in obj && obj[isPgEnumSym] === true;
}
var PgEnumColumnBuilder = class extends PgColumnBuilder {
	static [entityKind] = "PgEnumColumnBuilder";
	constructor(name, enumInstance) {
		super(name, "string", "PgEnumColumn");
		this.config.enum = enumInstance;
	}
	/** @internal */
	build(table) {
		return new PgEnumColumn(table, this.config);
	}
};
var PgEnumColumn = class extends PgColumn {
	static [entityKind] = "PgEnumColumn";
	enum = this.config.enum;
	enumValues = this.config.enum.enumValues;
	constructor(table, config) {
		super(table, config);
		this.enum = config.enum;
	}
	getSQLType() {
		return this.enum.enumName;
	}
};

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/subquery.js
var Subquery = class {
	static [entityKind] = "Subquery";
	constructor(sql$1, fields, alias, isWith = false, usedTables = []) {
		this._ = {
			brand: "Subquery",
			sql: sql$1,
			selectedFields: fields,
			alias,
			isWith,
			usedTables
		};
	}
};
var WithSubquery = class extends Subquery {
	static [entityKind] = "WithSubquery";
};

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/tracing.js
const tracer = { startActiveSpan(name, fn) {
	return fn();
} };

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/view-common.js
const ViewBaseConfig = Symbol.for("drizzle:ViewBaseConfig");

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/table.js
const Schema = Symbol.for("drizzle:Schema");
const Columns = Symbol.for("drizzle:Columns");
const ExtraConfigColumns = Symbol.for("drizzle:ExtraConfigColumns");
const OriginalName = Symbol.for("drizzle:OriginalName");
const BaseName = Symbol.for("drizzle:BaseName");
const IsAlias = Symbol.for("drizzle:IsAlias");
const ExtraConfigBuilder = Symbol.for("drizzle:ExtraConfigBuilder");
const IsDrizzleTable = Symbol.for("drizzle:IsDrizzleTable");
var Table = class {
	static [entityKind] = "Table";
	/** @internal */
	static Symbol = {
		Name: TableName,
		Schema,
		OriginalName,
		Columns,
		ExtraConfigColumns,
		BaseName,
		IsAlias,
		ExtraConfigBuilder
	};
	/**
	* @internal
	* Can be changed if the table is aliased.
	*/
	[TableName];
	/**
	* @internal
	* Used to store the original name of the table, before any aliasing.
	*/
	[OriginalName];
	/** @internal */
	[Schema];
	/** @internal */
	[Columns];
	/** @internal */
	[ExtraConfigColumns];
	/**
	*  @internal
	* Used to store the table name before the transformation via the `tableCreator` functions.
	*/
	[BaseName];
	/** @internal */
	[IsAlias] = false;
	/** @internal */
	[IsDrizzleTable] = true;
	/** @internal */
	[ExtraConfigBuilder] = void 0;
	constructor(name, schema, baseName) {
		this[TableName] = this[OriginalName] = name;
		this[Schema] = schema;
		this[BaseName] = baseName;
	}
};
function getTableName(table) {
	return table[TableName];
}
function getTableUniqueName(table) {
	return `${table[Schema] ?? "public"}.${table[TableName]}`;
}

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/sql/sql.js
var FakePrimitiveParam = class {
	static [entityKind] = "FakePrimitiveParam";
};
function isSQLWrapper(value) {
	return value !== null && value !== void 0 && typeof value.getSQL === "function";
}
function mergeQueries(queries) {
	const result = {
		sql: "",
		params: []
	};
	for (const query$1 of queries) {
		result.sql += query$1.sql;
		result.params.push(...query$1.params);
		if (query$1.typings?.length) {
			if (!result.typings) result.typings = [];
			result.typings.push(...query$1.typings);
		}
	}
	return result;
}
var StringChunk = class {
	static [entityKind] = "StringChunk";
	value;
	constructor(value) {
		this.value = Array.isArray(value) ? value : [value];
	}
	getSQL() {
		return new SQL([this]);
	}
};
var SQL = class SQL {
	constructor(queryChunks) {
		this.queryChunks = queryChunks;
		for (const chunk of queryChunks) if (is(chunk, Table)) {
			const schemaName = chunk[Table.Symbol.Schema];
			this.usedTables.push(schemaName === void 0 ? chunk[Table.Symbol.Name] : schemaName + "." + chunk[Table.Symbol.Name]);
		}
	}
	static [entityKind] = "SQL";
	/** @internal */
	decoder = noopDecoder;
	shouldInlineParams = false;
	/** @internal */
	usedTables = [];
	append(query$1) {
		this.queryChunks.push(...query$1.queryChunks);
		return this;
	}
	toQuery(config) {
		return tracer.startActiveSpan("drizzle.buildSQL", (span) => {
			const query$1 = this.buildQueryFromSourceParams(this.queryChunks, config);
			span?.setAttributes({
				"drizzle.query.text": query$1.sql,
				"drizzle.query.params": JSON.stringify(query$1.params)
			});
			return query$1;
		});
	}
	buildQueryFromSourceParams(chunks, _config) {
		const config = Object.assign({}, _config, {
			inlineParams: _config.inlineParams || this.shouldInlineParams,
			paramStartIndex: _config.paramStartIndex || { value: 0 }
		});
		const { casing, escapeName, escapeParam, prepareTyping, inlineParams, paramStartIndex } = config;
		return mergeQueries(chunks.map((chunk) => {
			if (is(chunk, StringChunk)) return {
				sql: chunk.value.join(""),
				params: []
			};
			if (is(chunk, Name)) return {
				sql: escapeName(chunk.value),
				params: []
			};
			if (chunk === void 0) return {
				sql: "",
				params: []
			};
			if (Array.isArray(chunk)) {
				const result = [new StringChunk("(")];
				for (const [i, p] of chunk.entries()) {
					result.push(p);
					if (i < chunk.length - 1) result.push(new StringChunk(", "));
				}
				result.push(new StringChunk(")"));
				return this.buildQueryFromSourceParams(result, config);
			}
			if (is(chunk, SQL)) return this.buildQueryFromSourceParams(chunk.queryChunks, {
				...config,
				inlineParams: inlineParams || chunk.shouldInlineParams
			});
			if (is(chunk, Table)) {
				const schemaName = chunk[Table.Symbol.Schema];
				const tableName = chunk[Table.Symbol.Name];
				return {
					sql: schemaName === void 0 || chunk[IsAlias] ? escapeName(tableName) : escapeName(schemaName) + "." + escapeName(tableName),
					params: []
				};
			}
			if (is(chunk, Column)) {
				const columnName = casing.getColumnCasing(chunk);
				if (_config.invokeSource === "indexes") return {
					sql: escapeName(columnName),
					params: []
				};
				const schemaName = chunk.table[Table.Symbol.Schema];
				return {
					sql: chunk.table[IsAlias] || schemaName === void 0 ? escapeName(chunk.table[Table.Symbol.Name]) + "." + escapeName(columnName) : escapeName(schemaName) + "." + escapeName(chunk.table[Table.Symbol.Name]) + "." + escapeName(columnName),
					params: []
				};
			}
			if (is(chunk, View)) {
				const schemaName = chunk[ViewBaseConfig].schema;
				const viewName = chunk[ViewBaseConfig].name;
				return {
					sql: schemaName === void 0 || chunk[ViewBaseConfig].isAlias ? escapeName(viewName) : escapeName(schemaName) + "." + escapeName(viewName),
					params: []
				};
			}
			if (is(chunk, Param)) {
				if (is(chunk.value, Placeholder)) return {
					sql: escapeParam(paramStartIndex.value++, chunk),
					params: [chunk],
					typings: ["none"]
				};
				const mappedValue = chunk.value === null ? null : chunk.encoder.mapToDriverValue(chunk.value);
				if (is(mappedValue, SQL)) return this.buildQueryFromSourceParams([mappedValue], config);
				if (inlineParams) return {
					sql: this.mapInlineParam(mappedValue, config),
					params: []
				};
				let typings = ["none"];
				if (prepareTyping) typings = [prepareTyping(chunk.encoder)];
				return {
					sql: escapeParam(paramStartIndex.value++, mappedValue),
					params: [mappedValue],
					typings
				};
			}
			if (is(chunk, Placeholder)) return {
				sql: escapeParam(paramStartIndex.value++, chunk),
				params: [chunk],
				typings: ["none"]
			};
			if (is(chunk, SQL.Aliased) && chunk.fieldAlias !== void 0) return {
				sql: escapeName(chunk.fieldAlias),
				params: []
			};
			if (is(chunk, Subquery)) {
				if (chunk._.isWith) return {
					sql: escapeName(chunk._.alias),
					params: []
				};
				return this.buildQueryFromSourceParams([
					new StringChunk("("),
					chunk._.sql,
					new StringChunk(") "),
					new Name(chunk._.alias)
				], config);
			}
			if (isPgEnum(chunk)) {
				if (chunk.schema) return {
					sql: escapeName(chunk.schema) + "." + escapeName(chunk.enumName),
					params: []
				};
				return {
					sql: escapeName(chunk.enumName),
					params: []
				};
			}
			if (isSQLWrapper(chunk)) {
				if (chunk.shouldOmitSQLParens?.()) return this.buildQueryFromSourceParams([chunk.getSQL()], config);
				return this.buildQueryFromSourceParams([
					new StringChunk("("),
					chunk.getSQL(),
					new StringChunk(")")
				], config);
			}
			if (inlineParams) return {
				sql: this.mapInlineParam(chunk, config),
				params: []
			};
			return {
				sql: escapeParam(paramStartIndex.value++, chunk),
				params: [chunk],
				typings: ["none"]
			};
		}));
	}
	mapInlineParam(chunk, { escapeString }) {
		if (chunk === null) return "null";
		if (typeof chunk === "number" || typeof chunk === "boolean") return chunk.toString();
		if (typeof chunk === "string") return escapeString(chunk);
		if (typeof chunk === "object") {
			const mappedValueAsString = chunk.toString();
			if (mappedValueAsString === "[object Object]") return escapeString(JSON.stringify(chunk));
			return escapeString(mappedValueAsString);
		}
		throw new Error("Unexpected param value: " + chunk);
	}
	getSQL() {
		return this;
	}
	as(alias) {
		if (alias === void 0) return this;
		return new SQL.Aliased(this, alias);
	}
	mapWith(decoder) {
		this.decoder = typeof decoder === "function" ? { mapFromDriverValue: decoder } : decoder;
		return this;
	}
	inlineParams() {
		this.shouldInlineParams = true;
		return this;
	}
	/**
	* This method is used to conditionally include a part of the query.
	*
	* @param condition - Condition to check
	* @returns itself if the condition is `true`, otherwise `undefined`
	*/
	if(condition) {
		return condition ? this : void 0;
	}
};
var Name = class {
	constructor(value) {
		this.value = value;
	}
	static [entityKind] = "Name";
	brand;
	getSQL() {
		return new SQL([this]);
	}
};
function isDriverValueEncoder(value) {
	return typeof value === "object" && value !== null && "mapToDriverValue" in value && typeof value.mapToDriverValue === "function";
}
const noopDecoder = { mapFromDriverValue: (value) => value };
const noopEncoder = { mapToDriverValue: (value) => value };
const noopMapper = {
	...noopDecoder,
	...noopEncoder
};
var Param = class {
	/**
	* @param value - Parameter value
	* @param encoder - Encoder to convert the value to a driver parameter
	*/
	constructor(value, encoder = noopEncoder) {
		this.value = value;
		this.encoder = encoder;
	}
	static [entityKind] = "Param";
	brand;
	getSQL() {
		return new SQL([this]);
	}
};
function sql(strings, ...params) {
	const queryChunks = [];
	if (params.length > 0 || strings.length > 0 && strings[0] !== "") queryChunks.push(new StringChunk(strings[0]));
	for (const [paramIndex, param2] of params.entries()) queryChunks.push(param2, new StringChunk(strings[paramIndex + 1]));
	return new SQL(queryChunks);
}
((sql2) => {
	function empty() {
		return new SQL([]);
	}
	sql2.empty = empty;
	function fromList(list) {
		return new SQL(list);
	}
	sql2.fromList = fromList;
	function raw(str) {
		return new SQL([new StringChunk(str)]);
	}
	sql2.raw = raw;
	function join(chunks, separator) {
		const result = [];
		for (const [i, chunk] of chunks.entries()) {
			if (i > 0 && separator !== void 0) result.push(separator);
			result.push(chunk);
		}
		return new SQL(result);
	}
	sql2.join = join;
	function identifier(value) {
		return new Name(value);
	}
	sql2.identifier = identifier;
	function placeholder2(name2) {
		return new Placeholder(name2);
	}
	sql2.placeholder = placeholder2;
	function param2(value, encoder) {
		return new Param(value, encoder);
	}
	sql2.param = param2;
})(sql || (sql = {}));
((SQL2) => {
	class Aliased {
		constructor(sql2, fieldAlias) {
			this.sql = sql2;
			this.fieldAlias = fieldAlias;
		}
		static [entityKind] = "SQL.Aliased";
		/** @internal */
		isSelectionField = false;
		getSQL() {
			return this.sql;
		}
		/** @internal */
		clone() {
			return new Aliased(this.sql, this.fieldAlias);
		}
	}
	SQL2.Aliased = Aliased;
})(SQL || (SQL = {}));
var Placeholder = class {
	constructor(name2) {
		this.name = name2;
	}
	static [entityKind] = "Placeholder";
	getSQL() {
		return new SQL([this]);
	}
};
function fillPlaceholders(params, values) {
	return params.map((p) => {
		if (is(p, Placeholder)) {
			if (!(p.name in values)) throw new Error(`No value for placeholder "${p.name}" was provided`);
			return values[p.name];
		}
		if (is(p, Param) && is(p.value, Placeholder)) {
			if (!(p.value.name in values)) throw new Error(`No value for placeholder "${p.value.name}" was provided`);
			return p.encoder.mapToDriverValue(values[p.value.name]);
		}
		return p;
	});
}
const IsDrizzleView = Symbol.for("drizzle:IsDrizzleView");
var View = class {
	static [entityKind] = "View";
	/** @internal */
	[ViewBaseConfig];
	/** @internal */
	[IsDrizzleView] = true;
	constructor({ name: name2, schema, selectedFields, query: query$1 }) {
		this[ViewBaseConfig] = {
			name: name2,
			originalName: name2,
			schema,
			selectedFields,
			query: query$1,
			isExisting: !query$1,
			isAlias: false
		};
	}
	getSQL() {
		return new SQL([this]);
	}
};
Column.prototype.getSQL = function() {
	return new SQL([this]);
};
Table.prototype.getSQL = function() {
	return new SQL([this]);
};
Subquery.prototype.getSQL = function() {
	return new SQL([this]);
};

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/alias.js
var ColumnAliasProxyHandler = class {
	constructor(table) {
		this.table = table;
	}
	static [entityKind] = "ColumnAliasProxyHandler";
	get(columnObj, prop) {
		if (prop === "table") return this.table;
		return columnObj[prop];
	}
};
var TableAliasProxyHandler = class {
	constructor(alias, replaceOriginalName) {
		this.alias = alias;
		this.replaceOriginalName = replaceOriginalName;
	}
	static [entityKind] = "TableAliasProxyHandler";
	get(target, prop) {
		if (prop === Table.Symbol.IsAlias) return true;
		if (prop === Table.Symbol.Name) return this.alias;
		if (this.replaceOriginalName && prop === Table.Symbol.OriginalName) return this.alias;
		if (prop === ViewBaseConfig) return {
			...target[ViewBaseConfig],
			name: this.alias,
			isAlias: true
		};
		if (prop === Table.Symbol.Columns) {
			const columns = target[Table.Symbol.Columns];
			if (!columns) return columns;
			const proxiedColumns = {};
			Object.keys(columns).map((key) => {
				proxiedColumns[key] = new Proxy(columns[key], new ColumnAliasProxyHandler(new Proxy(target, this)));
			});
			return proxiedColumns;
		}
		const value = target[prop];
		if (is(value, Column)) return new Proxy(value, new ColumnAliasProxyHandler(new Proxy(target, this)));
		return value;
	}
};
var RelationTableAliasProxyHandler = class {
	constructor(alias) {
		this.alias = alias;
	}
	static [entityKind] = "RelationTableAliasProxyHandler";
	get(target, prop) {
		if (prop === "sourceTable") return aliasedTable(target.sourceTable, this.alias);
		return target[prop];
	}
};
function aliasedTable(table, tableAlias) {
	return new Proxy(table, new TableAliasProxyHandler(tableAlias, false));
}
function aliasedTableColumn(column, tableAlias) {
	return new Proxy(column, new ColumnAliasProxyHandler(new Proxy(column.table, new TableAliasProxyHandler(tableAlias, false))));
}
function mapColumnsInAliasedSQLToAlias(query$1, alias) {
	return new SQL.Aliased(mapColumnsInSQLToAlias(query$1.sql, alias), query$1.fieldAlias);
}
function mapColumnsInSQLToAlias(query$1, alias) {
	return sql.join(query$1.queryChunks.map((c) => {
		if (is(c, Column)) return aliasedTableColumn(c, alias);
		if (is(c, SQL)) return mapColumnsInSQLToAlias(c, alias);
		if (is(c, SQL.Aliased)) return mapColumnsInAliasedSQLToAlias(c, alias);
		return c;
	}));
}

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/selection-proxy.js
var SelectionProxyHandler = class SelectionProxyHandler {
	static [entityKind] = "SelectionProxyHandler";
	config;
	constructor(config) {
		this.config = { ...config };
	}
	get(subquery, prop) {
		if (prop === "_") return {
			...subquery["_"],
			selectedFields: new Proxy(subquery._.selectedFields, this)
		};
		if (prop === ViewBaseConfig) return {
			...subquery[ViewBaseConfig],
			selectedFields: new Proxy(subquery[ViewBaseConfig].selectedFields, this)
		};
		if (typeof prop === "symbol") return subquery[prop];
		const value = (is(subquery, Subquery) ? subquery._.selectedFields : is(subquery, View) ? subquery[ViewBaseConfig].selectedFields : subquery)[prop];
		if (is(value, SQL.Aliased)) {
			if (this.config.sqlAliasedBehavior === "sql" && !value.isSelectionField) return value.sql;
			const newValue = value.clone();
			newValue.isSelectionField = true;
			return newValue;
		}
		if (is(value, SQL)) {
			if (this.config.sqlBehavior === "sql") return value;
			throw new Error(`You tried to reference "${prop}" field from a subquery, which is a raw SQL field, but it doesn't have an alias declared. Please add an alias to the field using ".as('alias')" method.`);
		}
		if (is(value, Column)) {
			if (this.config.alias) return new Proxy(value, new ColumnAliasProxyHandler(new Proxy(value.table, new TableAliasProxyHandler(this.config.alias, this.config.replaceOriginalName ?? false))));
			return value;
		}
		if (typeof value !== "object" || value === null) return value;
		return new Proxy(value, new SelectionProxyHandler(this.config));
	}
};

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/utils.js
function mapResultRow(columns, row, joinsNotNullableMap) {
	const nullifyMap = {};
	const result = columns.reduce((result2, { path: path$1, field }, columnIndex) => {
		let decoder;
		if (is(field, Column)) decoder = field;
		else if (is(field, SQL)) decoder = field.decoder;
		else if (is(field, Subquery)) decoder = field._.sql.decoder;
		else decoder = field.sql.decoder;
		let node = result2;
		for (const [pathChunkIndex, pathChunk] of path$1.entries()) if (pathChunkIndex < path$1.length - 1) {
			if (!(pathChunk in node)) node[pathChunk] = {};
			node = node[pathChunk];
		} else {
			const rawValue = row[columnIndex];
			const value = node[pathChunk] = rawValue === null ? null : decoder.mapFromDriverValue(rawValue);
			if (joinsNotNullableMap && is(field, Column) && path$1.length === 2) {
				const objectName = path$1[0];
				if (!(objectName in nullifyMap)) nullifyMap[objectName] = value === null ? getTableName(field.table) : false;
				else if (typeof nullifyMap[objectName] === "string" && nullifyMap[objectName] !== getTableName(field.table)) nullifyMap[objectName] = false;
			}
		}
		return result2;
	}, {});
	if (joinsNotNullableMap && Object.keys(nullifyMap).length > 0) {
		for (const [objectName, tableName] of Object.entries(nullifyMap)) if (typeof tableName === "string" && !joinsNotNullableMap[tableName]) result[objectName] = null;
	}
	return result;
}
function orderSelectedFields(fields, pathPrefix) {
	return Object.entries(fields).reduce((result, [name, field]) => {
		if (typeof name !== "string") return result;
		const newPath = pathPrefix ? [...pathPrefix, name] : [name];
		if (is(field, Column) || is(field, SQL) || is(field, SQL.Aliased) || is(field, Subquery)) result.push({
			path: newPath,
			field
		});
		else if (is(field, Table)) result.push(...orderSelectedFields(field[Table.Symbol.Columns], newPath));
		else result.push(...orderSelectedFields(field, newPath));
		return result;
	}, []);
}
function haveSameKeys(left, right) {
	const leftKeys = Object.keys(left);
	const rightKeys = Object.keys(right);
	if (leftKeys.length !== rightKeys.length) return false;
	for (const [index$1, key] of leftKeys.entries()) if (key !== rightKeys[index$1]) return false;
	return true;
}
function mapUpdateSet(table, values) {
	const entries = Object.entries(values).filter(([, value]) => value !== void 0).map(([key, value]) => {
		if (is(value, SQL) || is(value, Column)) return [key, value];
		else return [key, new Param(value, table[Table.Symbol.Columns][key])];
	});
	if (entries.length === 0) throw new Error("No values to set");
	return Object.fromEntries(entries);
}
function applyMixins(baseClass, extendedClasses) {
	for (const extendedClass of extendedClasses) for (const name of Object.getOwnPropertyNames(extendedClass.prototype)) {
		if (name === "constructor") continue;
		Object.defineProperty(baseClass.prototype, name, Object.getOwnPropertyDescriptor(extendedClass.prototype, name) || /* @__PURE__ */ Object.create(null));
	}
}
function getTableColumns(table) {
	return table[Table.Symbol.Columns];
}
function getTableLikeName(table) {
	return is(table, Subquery) ? table._.alias : is(table, View) ? table[ViewBaseConfig].name : is(table, SQL) ? void 0 : table[Table.Symbol.IsAlias] ? table[Table.Symbol.Name] : table[Table.Symbol.BaseName];
}
function getColumnNameAndConfig(a, b) {
	return {
		name: typeof a === "string" && a.length > 0 ? a : "",
		config: typeof a === "object" ? a : b
	};
}
function isConfig(data) {
	if (typeof data !== "object" || data === null) return false;
	if (data.constructor.name !== "Object") return false;
	if ("logger" in data) {
		const type = typeof data["logger"];
		if (type !== "boolean" && (type !== "object" || typeof data["logger"]["logQuery"] !== "function") && type !== "undefined") return false;
		return true;
	}
	if ("schema" in data) {
		const type = typeof data["schema"];
		if (type !== "object" && type !== "undefined") return false;
		return true;
	}
	if ("casing" in data) {
		const type = typeof data["casing"];
		if (type !== "string" && type !== "undefined") return false;
		return true;
	}
	if ("mode" in data) {
		if (data["mode"] !== "default" || data["mode"] !== "planetscale" || data["mode"] !== void 0) return false;
		return true;
	}
	if ("connection" in data) {
		const type = typeof data["connection"];
		if (type !== "string" && type !== "object" && type !== "undefined") return false;
		return true;
	}
	if ("client" in data) {
		const type = typeof data["client"];
		if (type !== "object" && type !== "function" && type !== "undefined") return false;
		return true;
	}
	if (Object.keys(data).length === 0) return true;
	return false;
}
const textDecoder = typeof TextDecoder === "undefined" ? null : new TextDecoder();

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/pg-core/columns/int.common.js
var PgIntColumnBaseBuilder = class extends PgColumnBuilder {
	static [entityKind] = "PgIntColumnBaseBuilder";
	generatedAlwaysAsIdentity(sequence) {
		if (sequence) {
			const { name, ...options } = sequence;
			this.config.generatedIdentity = {
				type: "always",
				sequenceName: name,
				sequenceOptions: options
			};
		} else this.config.generatedIdentity = { type: "always" };
		this.config.hasDefault = true;
		this.config.notNull = true;
		return this;
	}
	generatedByDefaultAsIdentity(sequence) {
		if (sequence) {
			const { name, ...options } = sequence;
			this.config.generatedIdentity = {
				type: "byDefault",
				sequenceName: name,
				sequenceOptions: options
			};
		} else this.config.generatedIdentity = { type: "byDefault" };
		this.config.hasDefault = true;
		this.config.notNull = true;
		return this;
	}
};

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/pg-core/columns/bigint.js
var PgBigInt53Builder = class extends PgIntColumnBaseBuilder {
	static [entityKind] = "PgBigInt53Builder";
	constructor(name) {
		super(name, "number", "PgBigInt53");
	}
	/** @internal */
	build(table) {
		return new PgBigInt53(table, this.config);
	}
};
var PgBigInt53 = class extends PgColumn {
	static [entityKind] = "PgBigInt53";
	getSQLType() {
		return "bigint";
	}
	mapFromDriverValue(value) {
		if (typeof value === "number") return value;
		return Number(value);
	}
};
var PgBigInt64Builder = class extends PgIntColumnBaseBuilder {
	static [entityKind] = "PgBigInt64Builder";
	constructor(name) {
		super(name, "bigint", "PgBigInt64");
	}
	/** @internal */
	build(table) {
		return new PgBigInt64(table, this.config);
	}
};
var PgBigInt64 = class extends PgColumn {
	static [entityKind] = "PgBigInt64";
	getSQLType() {
		return "bigint";
	}
	mapFromDriverValue(value) {
		return BigInt(value);
	}
};
function bigint(a, b) {
	const { name, config } = getColumnNameAndConfig(a, b);
	if (config.mode === "number") return new PgBigInt53Builder(name);
	return new PgBigInt64Builder(name);
}

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/pg-core/columns/bigserial.js
var PgBigSerial53Builder = class extends PgColumnBuilder {
	static [entityKind] = "PgBigSerial53Builder";
	constructor(name) {
		super(name, "number", "PgBigSerial53");
		this.config.hasDefault = true;
		this.config.notNull = true;
	}
	/** @internal */
	build(table) {
		return new PgBigSerial53(table, this.config);
	}
};
var PgBigSerial53 = class extends PgColumn {
	static [entityKind] = "PgBigSerial53";
	getSQLType() {
		return "bigserial";
	}
	mapFromDriverValue(value) {
		if (typeof value === "number") return value;
		return Number(value);
	}
};
var PgBigSerial64Builder = class extends PgColumnBuilder {
	static [entityKind] = "PgBigSerial64Builder";
	constructor(name) {
		super(name, "bigint", "PgBigSerial64");
		this.config.hasDefault = true;
	}
	/** @internal */
	build(table) {
		return new PgBigSerial64(table, this.config);
	}
};
var PgBigSerial64 = class extends PgColumn {
	static [entityKind] = "PgBigSerial64";
	getSQLType() {
		return "bigserial";
	}
	mapFromDriverValue(value) {
		return BigInt(value);
	}
};
function bigserial(a, b) {
	const { name, config } = getColumnNameAndConfig(a, b);
	if (config.mode === "number") return new PgBigSerial53Builder(name);
	return new PgBigSerial64Builder(name);
}

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/pg-core/columns/boolean.js
var PgBooleanBuilder = class extends PgColumnBuilder {
	static [entityKind] = "PgBooleanBuilder";
	constructor(name) {
		super(name, "boolean", "PgBoolean");
	}
	/** @internal */
	build(table) {
		return new PgBoolean(table, this.config);
	}
};
var PgBoolean = class extends PgColumn {
	static [entityKind] = "PgBoolean";
	getSQLType() {
		return "boolean";
	}
};
function boolean(name) {
	return new PgBooleanBuilder(name ?? "");
}

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/pg-core/columns/char.js
var PgCharBuilder = class extends PgColumnBuilder {
	static [entityKind] = "PgCharBuilder";
	constructor(name, config) {
		super(name, "string", "PgChar");
		this.config.length = config.length;
		this.config.enumValues = config.enum;
	}
	/** @internal */
	build(table) {
		return new PgChar(table, this.config);
	}
};
var PgChar = class extends PgColumn {
	static [entityKind] = "PgChar";
	length = this.config.length;
	enumValues = this.config.enumValues;
	getSQLType() {
		return this.length === void 0 ? `char` : `char(${this.length})`;
	}
};
function char(a, b = {}) {
	const { name, config } = getColumnNameAndConfig(a, b);
	return new PgCharBuilder(name, config);
}

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/pg-core/columns/cidr.js
var PgCidrBuilder = class extends PgColumnBuilder {
	static [entityKind] = "PgCidrBuilder";
	constructor(name) {
		super(name, "string", "PgCidr");
	}
	/** @internal */
	build(table) {
		return new PgCidr(table, this.config);
	}
};
var PgCidr = class extends PgColumn {
	static [entityKind] = "PgCidr";
	getSQLType() {
		return "cidr";
	}
};
function cidr(name) {
	return new PgCidrBuilder(name ?? "");
}

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/pg-core/columns/custom.js
var PgCustomColumnBuilder = class extends PgColumnBuilder {
	static [entityKind] = "PgCustomColumnBuilder";
	constructor(name, fieldConfig, customTypeParams) {
		super(name, "custom", "PgCustomColumn");
		this.config.fieldConfig = fieldConfig;
		this.config.customTypeParams = customTypeParams;
	}
	/** @internal */
	build(table) {
		return new PgCustomColumn(table, this.config);
	}
};
var PgCustomColumn = class extends PgColumn {
	static [entityKind] = "PgCustomColumn";
	sqlName;
	mapTo;
	mapFrom;
	constructor(table, config) {
		super(table, config);
		this.sqlName = config.customTypeParams.dataType(config.fieldConfig);
		this.mapTo = config.customTypeParams.toDriver;
		this.mapFrom = config.customTypeParams.fromDriver;
	}
	getSQLType() {
		return this.sqlName;
	}
	mapFromDriverValue(value) {
		return typeof this.mapFrom === "function" ? this.mapFrom(value) : value;
	}
	mapToDriverValue(value) {
		return typeof this.mapTo === "function" ? this.mapTo(value) : value;
	}
};
function customType(customTypeParams) {
	return (a, b) => {
		const { name, config } = getColumnNameAndConfig(a, b);
		return new PgCustomColumnBuilder(name, config, customTypeParams);
	};
}

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/pg-core/columns/date.common.js
var PgDateColumnBaseBuilder = class extends PgColumnBuilder {
	static [entityKind] = "PgDateColumnBaseBuilder";
	defaultNow() {
		return this.default(sql`now()`);
	}
};

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/pg-core/columns/date.js
var PgDateBuilder = class extends PgDateColumnBaseBuilder {
	static [entityKind] = "PgDateBuilder";
	constructor(name) {
		super(name, "date", "PgDate");
	}
	/** @internal */
	build(table) {
		return new PgDate(table, this.config);
	}
};
var PgDate = class extends PgColumn {
	static [entityKind] = "PgDate";
	getSQLType() {
		return "date";
	}
	mapFromDriverValue(value) {
		if (typeof value === "string") return new Date(value);
		return value;
	}
	mapToDriverValue(value) {
		return value.toISOString();
	}
};
var PgDateStringBuilder = class extends PgDateColumnBaseBuilder {
	static [entityKind] = "PgDateStringBuilder";
	constructor(name) {
		super(name, "string", "PgDateString");
	}
	/** @internal */
	build(table) {
		return new PgDateString(table, this.config);
	}
};
var PgDateString = class extends PgColumn {
	static [entityKind] = "PgDateString";
	getSQLType() {
		return "date";
	}
	mapFromDriverValue(value) {
		if (typeof value === "string") return value;
		return value.toISOString().slice(0, -14);
	}
};
function date(a, b) {
	const { name, config } = getColumnNameAndConfig(a, b);
	if (config?.mode === "date") return new PgDateBuilder(name);
	return new PgDateStringBuilder(name);
}

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/pg-core/columns/double-precision.js
var PgDoublePrecisionBuilder = class extends PgColumnBuilder {
	static [entityKind] = "PgDoublePrecisionBuilder";
	constructor(name) {
		super(name, "number", "PgDoublePrecision");
	}
	/** @internal */
	build(table) {
		return new PgDoublePrecision(table, this.config);
	}
};
var PgDoublePrecision = class extends PgColumn {
	static [entityKind] = "PgDoublePrecision";
	getSQLType() {
		return "double precision";
	}
	mapFromDriverValue(value) {
		if (typeof value === "string") return Number.parseFloat(value);
		return value;
	}
};
function doublePrecision(name) {
	return new PgDoublePrecisionBuilder(name ?? "");
}

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/pg-core/columns/inet.js
var PgInetBuilder = class extends PgColumnBuilder {
	static [entityKind] = "PgInetBuilder";
	constructor(name) {
		super(name, "string", "PgInet");
	}
	/** @internal */
	build(table) {
		return new PgInet(table, this.config);
	}
};
var PgInet = class extends PgColumn {
	static [entityKind] = "PgInet";
	getSQLType() {
		return "inet";
	}
};
function inet(name) {
	return new PgInetBuilder(name ?? "");
}

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/pg-core/columns/integer.js
var PgIntegerBuilder = class extends PgIntColumnBaseBuilder {
	static [entityKind] = "PgIntegerBuilder";
	constructor(name) {
		super(name, "number", "PgInteger");
	}
	/** @internal */
	build(table) {
		return new PgInteger(table, this.config);
	}
};
var PgInteger = class extends PgColumn {
	static [entityKind] = "PgInteger";
	getSQLType() {
		return "integer";
	}
	mapFromDriverValue(value) {
		if (typeof value === "string") return Number.parseInt(value);
		return value;
	}
};
function integer(name) {
	return new PgIntegerBuilder(name ?? "");
}

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/pg-core/columns/interval.js
var PgIntervalBuilder = class extends PgColumnBuilder {
	static [entityKind] = "PgIntervalBuilder";
	constructor(name, intervalConfig) {
		super(name, "string", "PgInterval");
		this.config.intervalConfig = intervalConfig;
	}
	/** @internal */
	build(table) {
		return new PgInterval(table, this.config);
	}
};
var PgInterval = class extends PgColumn {
	static [entityKind] = "PgInterval";
	fields = this.config.intervalConfig.fields;
	precision = this.config.intervalConfig.precision;
	getSQLType() {
		return `interval${this.fields ? ` ${this.fields}` : ""}${this.precision ? `(${this.precision})` : ""}`;
	}
};
function interval(a, b = {}) {
	const { name, config } = getColumnNameAndConfig(a, b);
	return new PgIntervalBuilder(name, config);
}

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/pg-core/columns/json.js
var PgJsonBuilder = class extends PgColumnBuilder {
	static [entityKind] = "PgJsonBuilder";
	constructor(name) {
		super(name, "json", "PgJson");
	}
	/** @internal */
	build(table) {
		return new PgJson(table, this.config);
	}
};
var PgJson = class extends PgColumn {
	static [entityKind] = "PgJson";
	constructor(table, config) {
		super(table, config);
	}
	getSQLType() {
		return "json";
	}
	mapToDriverValue(value) {
		return JSON.stringify(value);
	}
	mapFromDriverValue(value) {
		if (typeof value === "string") try {
			return JSON.parse(value);
		} catch {
			return value;
		}
		return value;
	}
};
function json(name) {
	return new PgJsonBuilder(name ?? "");
}

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/pg-core/columns/jsonb.js
var PgJsonbBuilder = class extends PgColumnBuilder {
	static [entityKind] = "PgJsonbBuilder";
	constructor(name) {
		super(name, "json", "PgJsonb");
	}
	/** @internal */
	build(table) {
		return new PgJsonb(table, this.config);
	}
};
var PgJsonb = class extends PgColumn {
	static [entityKind] = "PgJsonb";
	constructor(table, config) {
		super(table, config);
	}
	getSQLType() {
		return "jsonb";
	}
	mapToDriverValue(value) {
		return JSON.stringify(value);
	}
	mapFromDriverValue(value) {
		if (typeof value === "string") try {
			return JSON.parse(value);
		} catch {
			return value;
		}
		return value;
	}
};
function jsonb(name) {
	return new PgJsonbBuilder(name ?? "");
}

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/pg-core/columns/line.js
var PgLineBuilder = class extends PgColumnBuilder {
	static [entityKind] = "PgLineBuilder";
	constructor(name) {
		super(name, "array", "PgLine");
	}
	/** @internal */
	build(table) {
		return new PgLineTuple(table, this.config);
	}
};
var PgLineTuple = class extends PgColumn {
	static [entityKind] = "PgLine";
	getSQLType() {
		return "line";
	}
	mapFromDriverValue(value) {
		const [a, b, c] = value.slice(1, -1).split(",");
		return [
			Number.parseFloat(a),
			Number.parseFloat(b),
			Number.parseFloat(c)
		];
	}
	mapToDriverValue(value) {
		return `{${value[0]},${value[1]},${value[2]}}`;
	}
};
var PgLineABCBuilder = class extends PgColumnBuilder {
	static [entityKind] = "PgLineABCBuilder";
	constructor(name) {
		super(name, "json", "PgLineABC");
	}
	/** @internal */
	build(table) {
		return new PgLineABC(table, this.config);
	}
};
var PgLineABC = class extends PgColumn {
	static [entityKind] = "PgLineABC";
	getSQLType() {
		return "line";
	}
	mapFromDriverValue(value) {
		const [a, b, c] = value.slice(1, -1).split(",");
		return {
			a: Number.parseFloat(a),
			b: Number.parseFloat(b),
			c: Number.parseFloat(c)
		};
	}
	mapToDriverValue(value) {
		return `{${value.a},${value.b},${value.c}}`;
	}
};
function line(a, b) {
	const { name, config } = getColumnNameAndConfig(a, b);
	if (!config?.mode || config.mode === "tuple") return new PgLineBuilder(name);
	return new PgLineABCBuilder(name);
}

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/pg-core/columns/macaddr.js
var PgMacaddrBuilder = class extends PgColumnBuilder {
	static [entityKind] = "PgMacaddrBuilder";
	constructor(name) {
		super(name, "string", "PgMacaddr");
	}
	/** @internal */
	build(table) {
		return new PgMacaddr(table, this.config);
	}
};
var PgMacaddr = class extends PgColumn {
	static [entityKind] = "PgMacaddr";
	getSQLType() {
		return "macaddr";
	}
};
function macaddr(name) {
	return new PgMacaddrBuilder(name ?? "");
}

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/pg-core/columns/macaddr8.js
var PgMacaddr8Builder = class extends PgColumnBuilder {
	static [entityKind] = "PgMacaddr8Builder";
	constructor(name) {
		super(name, "string", "PgMacaddr8");
	}
	/** @internal */
	build(table) {
		return new PgMacaddr8(table, this.config);
	}
};
var PgMacaddr8 = class extends PgColumn {
	static [entityKind] = "PgMacaddr8";
	getSQLType() {
		return "macaddr8";
	}
};
function macaddr8(name) {
	return new PgMacaddr8Builder(name ?? "");
}

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/pg-core/columns/numeric.js
var PgNumericBuilder = class extends PgColumnBuilder {
	static [entityKind] = "PgNumericBuilder";
	constructor(name, precision, scale) {
		super(name, "string", "PgNumeric");
		this.config.precision = precision;
		this.config.scale = scale;
	}
	/** @internal */
	build(table) {
		return new PgNumeric(table, this.config);
	}
};
var PgNumeric = class extends PgColumn {
	static [entityKind] = "PgNumeric";
	precision;
	scale;
	constructor(table, config) {
		super(table, config);
		this.precision = config.precision;
		this.scale = config.scale;
	}
	mapFromDriverValue(value) {
		if (typeof value === "string") return value;
		return String(value);
	}
	getSQLType() {
		if (this.precision !== void 0 && this.scale !== void 0) return `numeric(${this.precision}, ${this.scale})`;
		else if (this.precision === void 0) return "numeric";
		else return `numeric(${this.precision})`;
	}
};
var PgNumericNumberBuilder = class extends PgColumnBuilder {
	static [entityKind] = "PgNumericNumberBuilder";
	constructor(name, precision, scale) {
		super(name, "number", "PgNumericNumber");
		this.config.precision = precision;
		this.config.scale = scale;
	}
	/** @internal */
	build(table) {
		return new PgNumericNumber(table, this.config);
	}
};
var PgNumericNumber = class extends PgColumn {
	static [entityKind] = "PgNumericNumber";
	precision;
	scale;
	constructor(table, config) {
		super(table, config);
		this.precision = config.precision;
		this.scale = config.scale;
	}
	mapFromDriverValue(value) {
		if (typeof value === "number") return value;
		return Number(value);
	}
	mapToDriverValue = String;
	getSQLType() {
		if (this.precision !== void 0 && this.scale !== void 0) return `numeric(${this.precision}, ${this.scale})`;
		else if (this.precision === void 0) return "numeric";
		else return `numeric(${this.precision})`;
	}
};
var PgNumericBigIntBuilder = class extends PgColumnBuilder {
	static [entityKind] = "PgNumericBigIntBuilder";
	constructor(name, precision, scale) {
		super(name, "bigint", "PgNumericBigInt");
		this.config.precision = precision;
		this.config.scale = scale;
	}
	/** @internal */
	build(table) {
		return new PgNumericBigInt(table, this.config);
	}
};
var PgNumericBigInt = class extends PgColumn {
	static [entityKind] = "PgNumericBigInt";
	precision;
	scale;
	constructor(table, config) {
		super(table, config);
		this.precision = config.precision;
		this.scale = config.scale;
	}
	mapFromDriverValue = BigInt;
	mapToDriverValue = String;
	getSQLType() {
		if (this.precision !== void 0 && this.scale !== void 0) return `numeric(${this.precision}, ${this.scale})`;
		else if (this.precision === void 0) return "numeric";
		else return `numeric(${this.precision})`;
	}
};
function numeric(a, b) {
	const { name, config } = getColumnNameAndConfig(a, b);
	const mode = config?.mode;
	return mode === "number" ? new PgNumericNumberBuilder(name, config?.precision, config?.scale) : mode === "bigint" ? new PgNumericBigIntBuilder(name, config?.precision, config?.scale) : new PgNumericBuilder(name, config?.precision, config?.scale);
}

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/pg-core/columns/point.js
var PgPointTupleBuilder = class extends PgColumnBuilder {
	static [entityKind] = "PgPointTupleBuilder";
	constructor(name) {
		super(name, "array", "PgPointTuple");
	}
	/** @internal */
	build(table) {
		return new PgPointTuple(table, this.config);
	}
};
var PgPointTuple = class extends PgColumn {
	static [entityKind] = "PgPointTuple";
	getSQLType() {
		return "point";
	}
	mapFromDriverValue(value) {
		if (typeof value === "string") {
			const [x, y] = value.slice(1, -1).split(",");
			return [Number.parseFloat(x), Number.parseFloat(y)];
		}
		return [value.x, value.y];
	}
	mapToDriverValue(value) {
		return `(${value[0]},${value[1]})`;
	}
};
var PgPointObjectBuilder = class extends PgColumnBuilder {
	static [entityKind] = "PgPointObjectBuilder";
	constructor(name) {
		super(name, "json", "PgPointObject");
	}
	/** @internal */
	build(table) {
		return new PgPointObject(table, this.config);
	}
};
var PgPointObject = class extends PgColumn {
	static [entityKind] = "PgPointObject";
	getSQLType() {
		return "point";
	}
	mapFromDriverValue(value) {
		if (typeof value === "string") {
			const [x, y] = value.slice(1, -1).split(",");
			return {
				x: Number.parseFloat(x),
				y: Number.parseFloat(y)
			};
		}
		return value;
	}
	mapToDriverValue(value) {
		return `(${value.x},${value.y})`;
	}
};
function point(a, b) {
	const { name, config } = getColumnNameAndConfig(a, b);
	if (!config?.mode || config.mode === "tuple") return new PgPointTupleBuilder(name);
	return new PgPointObjectBuilder(name);
}

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/pg-core/columns/postgis_extension/utils.js
function hexToBytes(hex) {
	const bytes = [];
	for (let c = 0; c < hex.length; c += 2) bytes.push(Number.parseInt(hex.slice(c, c + 2), 16));
	return new Uint8Array(bytes);
}
function bytesToFloat64(bytes, offset) {
	const buffer = /* @__PURE__ */ new ArrayBuffer(8);
	const view = new DataView(buffer);
	for (let i = 0; i < 8; i++) view.setUint8(i, bytes[offset + i]);
	return view.getFloat64(0, true);
}
function parseEWKB(hex) {
	const bytes = hexToBytes(hex);
	let offset = 0;
	const byteOrder = bytes[offset];
	offset += 1;
	const view = new DataView(bytes.buffer);
	const geomType = view.getUint32(offset, byteOrder === 1);
	offset += 4;
	if (geomType & 536870912) {
		view.getUint32(offset, byteOrder === 1);
		offset += 4;
	}
	if ((geomType & 65535) === 1) {
		const x = bytesToFloat64(bytes, offset);
		offset += 8;
		const y = bytesToFloat64(bytes, offset);
		offset += 8;
		return [x, y];
	}
	throw new Error("Unsupported geometry type");
}

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/pg-core/columns/postgis_extension/geometry.js
var PgGeometryBuilder = class extends PgColumnBuilder {
	static [entityKind] = "PgGeometryBuilder";
	constructor(name) {
		super(name, "array", "PgGeometry");
	}
	/** @internal */
	build(table) {
		return new PgGeometry(table, this.config);
	}
};
var PgGeometry = class extends PgColumn {
	static [entityKind] = "PgGeometry";
	getSQLType() {
		return "geometry(point)";
	}
	mapFromDriverValue(value) {
		return parseEWKB(value);
	}
	mapToDriverValue(value) {
		return `point(${value[0]} ${value[1]})`;
	}
};
var PgGeometryObjectBuilder = class extends PgColumnBuilder {
	static [entityKind] = "PgGeometryObjectBuilder";
	constructor(name) {
		super(name, "json", "PgGeometryObject");
	}
	/** @internal */
	build(table) {
		return new PgGeometryObject(table, this.config);
	}
};
var PgGeometryObject = class extends PgColumn {
	static [entityKind] = "PgGeometryObject";
	getSQLType() {
		return "geometry(point)";
	}
	mapFromDriverValue(value) {
		const parsed = parseEWKB(value);
		return {
			x: parsed[0],
			y: parsed[1]
		};
	}
	mapToDriverValue(value) {
		return `point(${value.x} ${value.y})`;
	}
};
function geometry(a, b) {
	const { name, config } = getColumnNameAndConfig(a, b);
	if (!config?.mode || config.mode === "tuple") return new PgGeometryBuilder(name);
	return new PgGeometryObjectBuilder(name);
}

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/pg-core/columns/real.js
var PgRealBuilder = class extends PgColumnBuilder {
	static [entityKind] = "PgRealBuilder";
	constructor(name, length) {
		super(name, "number", "PgReal");
		this.config.length = length;
	}
	/** @internal */
	build(table) {
		return new PgReal(table, this.config);
	}
};
var PgReal = class extends PgColumn {
	static [entityKind] = "PgReal";
	constructor(table, config) {
		super(table, config);
	}
	getSQLType() {
		return "real";
	}
	mapFromDriverValue = (value) => {
		if (typeof value === "string") return Number.parseFloat(value);
		return value;
	};
};
function real(name) {
	return new PgRealBuilder(name ?? "");
}

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/pg-core/columns/serial.js
var PgSerialBuilder = class extends PgColumnBuilder {
	static [entityKind] = "PgSerialBuilder";
	constructor(name) {
		super(name, "number", "PgSerial");
		this.config.hasDefault = true;
		this.config.notNull = true;
	}
	/** @internal */
	build(table) {
		return new PgSerial(table, this.config);
	}
};
var PgSerial = class extends PgColumn {
	static [entityKind] = "PgSerial";
	getSQLType() {
		return "serial";
	}
};
function serial(name) {
	return new PgSerialBuilder(name ?? "");
}

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/pg-core/columns/smallint.js
var PgSmallIntBuilder = class extends PgIntColumnBaseBuilder {
	static [entityKind] = "PgSmallIntBuilder";
	constructor(name) {
		super(name, "number", "PgSmallInt");
	}
	/** @internal */
	build(table) {
		return new PgSmallInt(table, this.config);
	}
};
var PgSmallInt = class extends PgColumn {
	static [entityKind] = "PgSmallInt";
	getSQLType() {
		return "smallint";
	}
	mapFromDriverValue = (value) => {
		if (typeof value === "string") return Number(value);
		return value;
	};
};
function smallint(name) {
	return new PgSmallIntBuilder(name ?? "");
}

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/pg-core/columns/smallserial.js
var PgSmallSerialBuilder = class extends PgColumnBuilder {
	static [entityKind] = "PgSmallSerialBuilder";
	constructor(name) {
		super(name, "number", "PgSmallSerial");
		this.config.hasDefault = true;
		this.config.notNull = true;
	}
	/** @internal */
	build(table) {
		return new PgSmallSerial(table, this.config);
	}
};
var PgSmallSerial = class extends PgColumn {
	static [entityKind] = "PgSmallSerial";
	getSQLType() {
		return "smallserial";
	}
};
function smallserial(name) {
	return new PgSmallSerialBuilder(name ?? "");
}

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/pg-core/columns/text.js
var PgTextBuilder = class extends PgColumnBuilder {
	static [entityKind] = "PgTextBuilder";
	constructor(name, config) {
		super(name, "string", "PgText");
		this.config.enumValues = config.enum;
	}
	/** @internal */
	build(table) {
		return new PgText(table, this.config);
	}
};
var PgText = class extends PgColumn {
	static [entityKind] = "PgText";
	enumValues = this.config.enumValues;
	getSQLType() {
		return "text";
	}
};
function text(a, b = {}) {
	const { name, config } = getColumnNameAndConfig(a, b);
	return new PgTextBuilder(name, config);
}

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/pg-core/columns/time.js
var PgTimeBuilder = class extends PgDateColumnBaseBuilder {
	constructor(name, withTimezone, precision) {
		super(name, "string", "PgTime");
		this.withTimezone = withTimezone;
		this.precision = precision;
		this.config.withTimezone = withTimezone;
		this.config.precision = precision;
	}
	static [entityKind] = "PgTimeBuilder";
	/** @internal */
	build(table) {
		return new PgTime(table, this.config);
	}
};
var PgTime = class extends PgColumn {
	static [entityKind] = "PgTime";
	withTimezone;
	precision;
	constructor(table, config) {
		super(table, config);
		this.withTimezone = config.withTimezone;
		this.precision = config.precision;
	}
	getSQLType() {
		return `time${this.precision === void 0 ? "" : `(${this.precision})`}${this.withTimezone ? " with time zone" : ""}`;
	}
};
function time(a, b = {}) {
	const { name, config } = getColumnNameAndConfig(a, b);
	return new PgTimeBuilder(name, config.withTimezone ?? false, config.precision);
}

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/pg-core/columns/timestamp.js
var PgTimestampBuilder = class extends PgDateColumnBaseBuilder {
	static [entityKind] = "PgTimestampBuilder";
	constructor(name, withTimezone, precision) {
		super(name, "date", "PgTimestamp");
		this.config.withTimezone = withTimezone;
		this.config.precision = precision;
	}
	/** @internal */
	build(table) {
		return new PgTimestamp(table, this.config);
	}
};
var PgTimestamp = class extends PgColumn {
	static [entityKind] = "PgTimestamp";
	withTimezone;
	precision;
	constructor(table, config) {
		super(table, config);
		this.withTimezone = config.withTimezone;
		this.precision = config.precision;
	}
	getSQLType() {
		return `timestamp${this.precision === void 0 ? "" : ` (${this.precision})`}${this.withTimezone ? " with time zone" : ""}`;
	}
	mapFromDriverValue(value) {
		if (typeof value === "string") return new Date(this.withTimezone ? value : value + "+0000");
		return value;
	}
	mapToDriverValue = (value) => {
		return value.toISOString();
	};
};
var PgTimestampStringBuilder = class extends PgDateColumnBaseBuilder {
	static [entityKind] = "PgTimestampStringBuilder";
	constructor(name, withTimezone, precision) {
		super(name, "string", "PgTimestampString");
		this.config.withTimezone = withTimezone;
		this.config.precision = precision;
	}
	/** @internal */
	build(table) {
		return new PgTimestampString(table, this.config);
	}
};
var PgTimestampString = class extends PgColumn {
	static [entityKind] = "PgTimestampString";
	withTimezone;
	precision;
	constructor(table, config) {
		super(table, config);
		this.withTimezone = config.withTimezone;
		this.precision = config.precision;
	}
	getSQLType() {
		return `timestamp${this.precision === void 0 ? "" : `(${this.precision})`}${this.withTimezone ? " with time zone" : ""}`;
	}
	mapFromDriverValue(value) {
		if (typeof value === "string") return value;
		const shortened = value.toISOString().slice(0, -1).replace("T", " ");
		if (this.withTimezone) {
			const offset = value.getTimezoneOffset();
			return `${shortened}${offset <= 0 ? "+" : "-"}${Math.floor(Math.abs(offset) / 60).toString().padStart(2, "0")}`;
		}
		return shortened;
	}
};
function timestamp(a, b = {}) {
	const { name, config } = getColumnNameAndConfig(a, b);
	if (config?.mode === "string") return new PgTimestampStringBuilder(name, config.withTimezone ?? false, config.precision);
	return new PgTimestampBuilder(name, config?.withTimezone ?? false, config?.precision);
}

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/pg-core/columns/uuid.js
var PgUUIDBuilder = class extends PgColumnBuilder {
	static [entityKind] = "PgUUIDBuilder";
	constructor(name) {
		super(name, "string", "PgUUID");
	}
	/**
	* Adds `default gen_random_uuid()` to the column definition.
	*/
	defaultRandom() {
		return this.default(sql`gen_random_uuid()`);
	}
	/** @internal */
	build(table) {
		return new PgUUID(table, this.config);
	}
};
var PgUUID = class extends PgColumn {
	static [entityKind] = "PgUUID";
	getSQLType() {
		return "uuid";
	}
};
function uuid(name) {
	return new PgUUIDBuilder(name ?? "");
}

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/pg-core/columns/varchar.js
var PgVarcharBuilder = class extends PgColumnBuilder {
	static [entityKind] = "PgVarcharBuilder";
	constructor(name, config) {
		super(name, "string", "PgVarchar");
		this.config.length = config.length;
		this.config.enumValues = config.enum;
	}
	/** @internal */
	build(table) {
		return new PgVarchar(table, this.config);
	}
};
var PgVarchar = class extends PgColumn {
	static [entityKind] = "PgVarchar";
	length = this.config.length;
	enumValues = this.config.enumValues;
	getSQLType() {
		return this.length === void 0 ? `varchar` : `varchar(${this.length})`;
	}
};
function varchar(a, b = {}) {
	const { name, config } = getColumnNameAndConfig(a, b);
	return new PgVarcharBuilder(name, config);
}

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/pg-core/columns/vector_extension/bit.js
var PgBinaryVectorBuilder = class extends PgColumnBuilder {
	static [entityKind] = "PgBinaryVectorBuilder";
	constructor(name, config) {
		super(name, "string", "PgBinaryVector");
		this.config.dimensions = config.dimensions;
	}
	/** @internal */
	build(table) {
		return new PgBinaryVector(table, this.config);
	}
};
var PgBinaryVector = class extends PgColumn {
	static [entityKind] = "PgBinaryVector";
	dimensions = this.config.dimensions;
	getSQLType() {
		return `bit(${this.dimensions})`;
	}
};
function bit(a, b) {
	const { name, config } = getColumnNameAndConfig(a, b);
	return new PgBinaryVectorBuilder(name, config);
}

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/pg-core/columns/vector_extension/halfvec.js
var PgHalfVectorBuilder = class extends PgColumnBuilder {
	static [entityKind] = "PgHalfVectorBuilder";
	constructor(name, config) {
		super(name, "array", "PgHalfVector");
		this.config.dimensions = config.dimensions;
	}
	/** @internal */
	build(table) {
		return new PgHalfVector(table, this.config);
	}
};
var PgHalfVector = class extends PgColumn {
	static [entityKind] = "PgHalfVector";
	dimensions = this.config.dimensions;
	getSQLType() {
		return `halfvec(${this.dimensions})`;
	}
	mapToDriverValue(value) {
		return JSON.stringify(value);
	}
	mapFromDriverValue(value) {
		return value.slice(1, -1).split(",").map((v) => Number.parseFloat(v));
	}
};
function halfvec(a, b) {
	const { name, config } = getColumnNameAndConfig(a, b);
	return new PgHalfVectorBuilder(name, config);
}

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/pg-core/columns/vector_extension/sparsevec.js
var PgSparseVectorBuilder = class extends PgColumnBuilder {
	static [entityKind] = "PgSparseVectorBuilder";
	constructor(name, config) {
		super(name, "string", "PgSparseVector");
		this.config.dimensions = config.dimensions;
	}
	/** @internal */
	build(table) {
		return new PgSparseVector(table, this.config);
	}
};
var PgSparseVector = class extends PgColumn {
	static [entityKind] = "PgSparseVector";
	dimensions = this.config.dimensions;
	getSQLType() {
		return `sparsevec(${this.dimensions})`;
	}
};
function sparsevec(a, b) {
	const { name, config } = getColumnNameAndConfig(a, b);
	return new PgSparseVectorBuilder(name, config);
}

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/pg-core/columns/vector_extension/vector.js
var PgVectorBuilder = class extends PgColumnBuilder {
	static [entityKind] = "PgVectorBuilder";
	constructor(name, config) {
		super(name, "array", "PgVector");
		this.config.dimensions = config.dimensions;
	}
	/** @internal */
	build(table) {
		return new PgVector(table, this.config);
	}
};
var PgVector = class extends PgColumn {
	static [entityKind] = "PgVector";
	dimensions = this.config.dimensions;
	getSQLType() {
		return `vector(${this.dimensions})`;
	}
	mapToDriverValue(value) {
		return JSON.stringify(value);
	}
	mapFromDriverValue(value) {
		return value.slice(1, -1).split(",").map((v) => Number.parseFloat(v));
	}
};
function vector(a, b) {
	const { name, config } = getColumnNameAndConfig(a, b);
	return new PgVectorBuilder(name, config);
}

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/pg-core/columns/all.js
function getPgColumnBuilders() {
	return {
		bigint,
		bigserial,
		boolean,
		char,
		cidr,
		customType,
		date,
		doublePrecision,
		inet,
		integer,
		interval,
		json,
		jsonb,
		line,
		macaddr,
		macaddr8,
		numeric,
		point,
		geometry,
		real,
		serial,
		smallint,
		smallserial,
		text,
		time,
		timestamp,
		uuid,
		varchar,
		bit,
		halfvec,
		sparsevec,
		vector
	};
}

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/pg-core/table.js
const InlineForeignKeys = Symbol.for("drizzle:PgInlineForeignKeys");
const EnableRLS = Symbol.for("drizzle:EnableRLS");
var PgTable = class extends Table {
	static [entityKind] = "PgTable";
	/** @internal */
	static Symbol = Object.assign({}, Table.Symbol, {
		InlineForeignKeys,
		EnableRLS
	});
	/**@internal */
	[InlineForeignKeys] = [];
	/** @internal */
	[EnableRLS] = false;
	/** @internal */
	[Table.Symbol.ExtraConfigBuilder] = void 0;
	/** @internal */
	[Table.Symbol.ExtraConfigColumns] = {};
};
function pgTableWithSchema(name, columns, extraConfig, schema, baseName = name) {
	const rawTable = new PgTable(name, schema, baseName);
	const parsedColumns = typeof columns === "function" ? columns(getPgColumnBuilders()) : columns;
	const builtColumns = Object.fromEntries(Object.entries(parsedColumns).map(([name2, colBuilderBase]) => {
		const colBuilder = colBuilderBase;
		colBuilder.setName(name2);
		const column = colBuilder.build(rawTable);
		rawTable[InlineForeignKeys].push(...colBuilder.buildForeignKeys(column, rawTable));
		return [name2, column];
	}));
	const builtColumnsForExtraConfig = Object.fromEntries(Object.entries(parsedColumns).map(([name2, colBuilderBase]) => {
		const colBuilder = colBuilderBase;
		colBuilder.setName(name2);
		return [name2, colBuilder.buildExtraConfigColumn(rawTable)];
	}));
	const table = Object.assign(rawTable, builtColumns);
	table[Table.Symbol.Columns] = builtColumns;
	table[Table.Symbol.ExtraConfigColumns] = builtColumnsForExtraConfig;
	if (extraConfig) table[PgTable.Symbol.ExtraConfigBuilder] = extraConfig;
	return Object.assign(table, { enableRLS: () => {
		table[PgTable.Symbol.EnableRLS] = true;
		return table;
	} });
}
const pgTable = (name, columns, extraConfig) => {
	return pgTableWithSchema(name, columns, extraConfig, void 0);
};

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/pg-core/indexes.js
var IndexBuilderOn = class {
	constructor(unique, name) {
		this.unique = unique;
		this.name = name;
	}
	static [entityKind] = "PgIndexBuilderOn";
	on(...columns) {
		return new IndexBuilder(columns.map((it) => {
			if (is(it, SQL)) return it;
			it = it;
			const clonedIndexedColumn = new IndexedColumn(it.name, !!it.keyAsName, it.columnType, it.indexConfig);
			it.indexConfig = JSON.parse(JSON.stringify(it.defaultConfig));
			return clonedIndexedColumn;
		}), this.unique, false, this.name);
	}
	onOnly(...columns) {
		return new IndexBuilder(columns.map((it) => {
			if (is(it, SQL)) return it;
			it = it;
			const clonedIndexedColumn = new IndexedColumn(it.name, !!it.keyAsName, it.columnType, it.indexConfig);
			it.indexConfig = it.defaultConfig;
			return clonedIndexedColumn;
		}), this.unique, true, this.name);
	}
	/**
	* Specify what index method to use. Choices are `btree`, `hash`, `gist`, `spgist`, `gin`, `brin`, or user-installed access methods like `bloom`. The default method is `btree.
	*
	* If you have the `pg_vector` extension installed in your database, you can use the `hnsw` and `ivfflat` options, which are predefined types.
	*
	* **You can always specify any string you want in the method, in case Drizzle doesn't have it natively in its types**
	*
	* @param method The name of the index method to be used
	* @param columns
	* @returns
	*/
	using(method, ...columns) {
		return new IndexBuilder(columns.map((it) => {
			if (is(it, SQL)) return it;
			it = it;
			const clonedIndexedColumn = new IndexedColumn(it.name, !!it.keyAsName, it.columnType, it.indexConfig);
			it.indexConfig = JSON.parse(JSON.stringify(it.defaultConfig));
			return clonedIndexedColumn;
		}), this.unique, true, this.name, method);
	}
};
var IndexBuilder = class {
	static [entityKind] = "PgIndexBuilder";
	/** @internal */
	config;
	constructor(columns, unique, only, name, method = "btree") {
		this.config = {
			name,
			columns,
			unique,
			only,
			method
		};
	}
	concurrently() {
		this.config.concurrently = true;
		return this;
	}
	with(obj) {
		this.config.with = obj;
		return this;
	}
	where(condition) {
		this.config.where = condition;
		return this;
	}
	/** @internal */
	build(table) {
		return new Index(this.config, table);
	}
};
var Index = class {
	static [entityKind] = "PgIndex";
	config;
	constructor(config, table) {
		this.config = {
			...config,
			table
		};
	}
};
function index(name) {
	return new IndexBuilderOn(false, name);
}

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/pg-core/primary-keys.js
var PrimaryKeyBuilder = class {
	static [entityKind] = "PgPrimaryKeyBuilder";
	/** @internal */
	columns;
	/** @internal */
	name;
	constructor(columns, name) {
		this.columns = columns;
		this.name = name;
	}
	/** @internal */
	build(table) {
		return new PrimaryKey(table, this.columns, this.name);
	}
};
var PrimaryKey = class {
	constructor(table, columns, name) {
		this.table = table;
		this.columns = columns;
		this.name = name;
	}
	static [entityKind] = "PgPrimaryKey";
	columns;
	name;
	getName() {
		return this.name ?? `${this.table[PgTable.Symbol.Name]}_${this.columns.map((column) => column.name).join("_")}_pk`;
	}
};

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/casing.js
function toSnakeCase(input) {
	return (input.replace(/['\u2019]/g, "").match(/[\da-z]+|[A-Z]+(?![a-z])|[A-Z][\da-z]+/g) ?? []).map((word) => word.toLowerCase()).join("_");
}
function toCamelCase(input) {
	return (input.replace(/['\u2019]/g, "").match(/[\da-z]+|[A-Z]+(?![a-z])|[A-Z][\da-z]+/g) ?? []).reduce((acc, word, i) => {
		return acc + (i === 0 ? word.toLowerCase() : `${word[0].toUpperCase()}${word.slice(1)}`);
	}, "");
}
function noopCase(input) {
	return input;
}
var CasingCache = class {
	static [entityKind] = "CasingCache";
	/** @internal */
	cache = {};
	cachedTables = {};
	convert;
	constructor(casing) {
		this.convert = casing === "snake_case" ? toSnakeCase : casing === "camelCase" ? toCamelCase : noopCase;
	}
	getColumnCasing(column) {
		if (!column.keyAsName) return column.name;
		const key = `${column.table[Table.Symbol.Schema] ?? "public"}.${column.table[Table.Symbol.OriginalName]}.${column.name}`;
		if (!this.cache[key]) this.cacheTable(column.table);
		return this.cache[key];
	}
	cacheTable(table) {
		const tableKey = `${table[Table.Symbol.Schema] ?? "public"}.${table[Table.Symbol.OriginalName]}`;
		if (!this.cachedTables[tableKey]) {
			for (const column of Object.values(table[Table.Symbol.Columns])) {
				const columnKey = `${tableKey}.${column.name}`;
				this.cache[columnKey] = this.convert(column.name);
			}
			this.cachedTables[tableKey] = true;
		}
	}
	clearCache() {
		this.cache = {};
		this.cachedTables = {};
	}
};

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/errors.js
var DrizzleError = class extends Error {
	static [entityKind] = "DrizzleError";
	constructor({ message, cause }) {
		super(message);
		this.name = "DrizzleError";
		this.cause = cause;
	}
};
var DrizzleQueryError = class DrizzleQueryError extends Error {
	constructor(query$1, params, cause) {
		super(`Failed query: ${query$1}
params: ${params}`);
		this.query = query$1;
		this.params = params;
		this.cause = cause;
		Error.captureStackTrace(this, DrizzleQueryError);
		if (cause) this.cause = cause;
	}
};
var TransactionRollbackError = class extends DrizzleError {
	static [entityKind] = "TransactionRollbackError";
	constructor() {
		super({ message: "Rollback" });
	}
};

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/sql/expressions/conditions.js
function bindIfParam(value, column) {
	if (isDriverValueEncoder(column) && !isSQLWrapper(value) && !is(value, Param) && !is(value, Placeholder) && !is(value, Column) && !is(value, Table) && !is(value, View)) return new Param(value, column);
	return value;
}
const eq = (left, right) => {
	return sql`${left} = ${bindIfParam(right, left)}`;
};
const ne = (left, right) => {
	return sql`${left} <> ${bindIfParam(right, left)}`;
};
function and(...unfilteredConditions) {
	const conditions = unfilteredConditions.filter((c) => c !== void 0);
	if (conditions.length === 0) return;
	if (conditions.length === 1) return new SQL(conditions);
	return new SQL([
		new StringChunk("("),
		sql.join(conditions, new StringChunk(" and ")),
		new StringChunk(")")
	]);
}
function or(...unfilteredConditions) {
	const conditions = unfilteredConditions.filter((c) => c !== void 0);
	if (conditions.length === 0) return;
	if (conditions.length === 1) return new SQL(conditions);
	return new SQL([
		new StringChunk("("),
		sql.join(conditions, new StringChunk(" or ")),
		new StringChunk(")")
	]);
}
function not(condition) {
	return sql`not ${condition}`;
}
const gt = (left, right) => {
	return sql`${left} > ${bindIfParam(right, left)}`;
};
const gte = (left, right) => {
	return sql`${left} >= ${bindIfParam(right, left)}`;
};
const lt = (left, right) => {
	return sql`${left} < ${bindIfParam(right, left)}`;
};
const lte = (left, right) => {
	return sql`${left} <= ${bindIfParam(right, left)}`;
};
function inArray(column, values) {
	if (Array.isArray(values)) {
		if (values.length === 0) return sql`false`;
		return sql`${column} in ${values.map((v) => bindIfParam(v, column))}`;
	}
	return sql`${column} in ${bindIfParam(values, column)}`;
}
function notInArray(column, values) {
	if (Array.isArray(values)) {
		if (values.length === 0) return sql`true`;
		return sql`${column} not in ${values.map((v) => bindIfParam(v, column))}`;
	}
	return sql`${column} not in ${bindIfParam(values, column)}`;
}
function isNull(value) {
	return sql`${value} is null`;
}
function isNotNull(value) {
	return sql`${value} is not null`;
}
function exists(subquery) {
	return sql`exists ${subquery}`;
}
function notExists(subquery) {
	return sql`not exists ${subquery}`;
}
function between(column, min, max) {
	return sql`${column} between ${bindIfParam(min, column)} and ${bindIfParam(max, column)}`;
}
function notBetween(column, min, max) {
	return sql`${column} not between ${bindIfParam(min, column)} and ${bindIfParam(max, column)}`;
}
function like(column, value) {
	return sql`${column} like ${value}`;
}
function notLike(column, value) {
	return sql`${column} not like ${value}`;
}
function ilike(column, value) {
	return sql`${column} ilike ${value}`;
}
function notIlike(column, value) {
	return sql`${column} not ilike ${value}`;
}

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/sql/expressions/select.js
function asc(column) {
	return sql`${column} asc`;
}
function desc(column) {
	return sql`${column} desc`;
}

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/relations.js
var Relation = class {
	constructor(sourceTable, referencedTable, relationName) {
		this.sourceTable = sourceTable;
		this.referencedTable = referencedTable;
		this.relationName = relationName;
		this.referencedTableName = referencedTable[Table.Symbol.Name];
	}
	static [entityKind] = "Relation";
	referencedTableName;
	fieldName;
};
var Relations = class {
	constructor(table, config) {
		this.table = table;
		this.config = config;
	}
	static [entityKind] = "Relations";
};
var One = class One extends Relation {
	constructor(sourceTable, referencedTable, config, isNullable) {
		super(sourceTable, referencedTable, config?.relationName);
		this.config = config;
		this.isNullable = isNullable;
	}
	static [entityKind] = "One";
	withFieldName(fieldName) {
		const relation = new One(this.sourceTable, this.referencedTable, this.config, this.isNullable);
		relation.fieldName = fieldName;
		return relation;
	}
};
var Many = class Many extends Relation {
	constructor(sourceTable, referencedTable, config) {
		super(sourceTable, referencedTable, config?.relationName);
		this.config = config;
	}
	static [entityKind] = "Many";
	withFieldName(fieldName) {
		const relation = new Many(this.sourceTable, this.referencedTable, this.config);
		relation.fieldName = fieldName;
		return relation;
	}
};
function getOperators() {
	return {
		and,
		between,
		eq,
		exists,
		gt,
		gte,
		ilike,
		inArray,
		isNull,
		isNotNull,
		like,
		lt,
		lte,
		ne,
		not,
		notBetween,
		notExists,
		notLike,
		notIlike,
		notInArray,
		or,
		sql
	};
}
function getOrderByOperators() {
	return {
		sql,
		asc,
		desc
	};
}
function extractTablesRelationalConfig(schema, configHelpers) {
	if (Object.keys(schema).length === 1 && "default" in schema && !is(schema["default"], Table)) schema = schema["default"];
	const tableNamesMap = {};
	const relationsBuffer = {};
	const tablesConfig = {};
	for (const [key, value] of Object.entries(schema)) if (is(value, Table)) {
		const dbName = getTableUniqueName(value);
		const bufferedRelations = relationsBuffer[dbName];
		tableNamesMap[dbName] = key;
		tablesConfig[key] = {
			tsName: key,
			dbName: value[Table.Symbol.Name],
			schema: value[Table.Symbol.Schema],
			columns: value[Table.Symbol.Columns],
			relations: bufferedRelations?.relations ?? {},
			primaryKey: bufferedRelations?.primaryKey ?? []
		};
		for (const column of Object.values(value[Table.Symbol.Columns])) if (column.primary) tablesConfig[key].primaryKey.push(column);
		const extraConfig = value[Table.Symbol.ExtraConfigBuilder]?.(value[Table.Symbol.ExtraConfigColumns]);
		if (extraConfig) {
			for (const configEntry of Object.values(extraConfig)) if (is(configEntry, PrimaryKeyBuilder)) tablesConfig[key].primaryKey.push(...configEntry.columns);
		}
	} else if (is(value, Relations)) {
		const dbName = getTableUniqueName(value.table);
		const tableName = tableNamesMap[dbName];
		const relations2 = value.config(configHelpers(value.table));
		let primaryKey;
		for (const [relationName, relation] of Object.entries(relations2)) if (tableName) {
			const tableConfig = tablesConfig[tableName];
			tableConfig.relations[relationName] = relation;
		} else {
			if (!(dbName in relationsBuffer)) relationsBuffer[dbName] = {
				relations: {},
				primaryKey
			};
			relationsBuffer[dbName].relations[relationName] = relation;
		}
	}
	return {
		tables: tablesConfig,
		tableNamesMap
	};
}
function relations(table, relations2) {
	return new Relations(table, (helpers) => Object.fromEntries(Object.entries(relations2(helpers)).map(([key, value]) => [key, value.withFieldName(key)])));
}
function createOne(sourceTable) {
	return function one(table, config) {
		return new One(sourceTable, table, config, config?.fields.reduce((res, f) => res && f.notNull, true) ?? false);
	};
}
function createMany(sourceTable) {
	return function many(referencedTable, config) {
		return new Many(sourceTable, referencedTable, config);
	};
}
function normalizeRelation(schema, tableNamesMap, relation) {
	if (is(relation, One) && relation.config) return {
		fields: relation.config.fields,
		references: relation.config.references
	};
	const referencedTableTsName = tableNamesMap[getTableUniqueName(relation.referencedTable)];
	if (!referencedTableTsName) throw new Error(`Table "${relation.referencedTable[Table.Symbol.Name]}" not found in schema`);
	const referencedTableConfig = schema[referencedTableTsName];
	if (!referencedTableConfig) throw new Error(`Table "${referencedTableTsName}" not found in schema`);
	const sourceTable = relation.sourceTable;
	const sourceTableTsName = tableNamesMap[getTableUniqueName(sourceTable)];
	if (!sourceTableTsName) throw new Error(`Table "${sourceTable[Table.Symbol.Name]}" not found in schema`);
	const reverseRelations = [];
	for (const referencedTableRelation of Object.values(referencedTableConfig.relations)) if (relation.relationName && relation !== referencedTableRelation && referencedTableRelation.relationName === relation.relationName || !relation.relationName && referencedTableRelation.referencedTable === relation.sourceTable) reverseRelations.push(referencedTableRelation);
	if (reverseRelations.length > 1) throw relation.relationName ? /* @__PURE__ */ new Error(`There are multiple relations with name "${relation.relationName}" in table "${referencedTableTsName}"`) : /* @__PURE__ */ new Error(`There are multiple relations between "${referencedTableTsName}" and "${relation.sourceTable[Table.Symbol.Name]}". Please specify relation name`);
	if (reverseRelations[0] && is(reverseRelations[0], One) && reverseRelations[0].config) return {
		fields: reverseRelations[0].config.references,
		references: reverseRelations[0].config.fields
	};
	throw new Error(`There is not enough information to infer relation "${sourceTableTsName}.${relation.fieldName}"`);
}
function createTableRelationsHelpers(sourceTable) {
	return {
		one: createOne(sourceTable),
		many: createMany(sourceTable)
	};
}
function mapRelationalRow(tablesConfig, tableConfig, row, buildQueryResultSelection, mapColumnValue = (value) => value) {
	const result = {};
	for (const [selectionItemIndex, selectionItem] of buildQueryResultSelection.entries()) if (selectionItem.isJson) {
		const relation = tableConfig.relations[selectionItem.tsKey];
		const rawSubRows = row[selectionItemIndex];
		const subRows = typeof rawSubRows === "string" ? JSON.parse(rawSubRows) : rawSubRows;
		result[selectionItem.tsKey] = is(relation, One) ? subRows && mapRelationalRow(tablesConfig, tablesConfig[selectionItem.relationTableTsKey], subRows, selectionItem.selection, mapColumnValue) : subRows.map((subRow) => mapRelationalRow(tablesConfig, tablesConfig[selectionItem.relationTableTsKey], subRow, selectionItem.selection, mapColumnValue));
	} else {
		const value = mapColumnValue(row[selectionItemIndex]);
		const field = selectionItem.field;
		let decoder;
		if (is(field, Column)) decoder = field;
		else if (is(field, SQL)) decoder = field.decoder;
		else decoder = field.sql.decoder;
		result[selectionItem.tsKey] = value === null ? null : decoder.mapFromDriverValue(value);
	}
	return result;
}

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/pg-core/view-base.js
var PgViewBase = class extends View {
	static [entityKind] = "PgViewBase";
};

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/pg-core/dialect.js
var PgDialect = class {
	static [entityKind] = "PgDialect";
	/** @internal */
	casing;
	constructor(config) {
		this.casing = new CasingCache(config?.casing);
	}
	async migrate(migrations, session$1, config) {
		const migrationsTable = typeof config === "string" ? "__drizzle_migrations" : config.migrationsTable ?? "__drizzle_migrations";
		const migrationsSchema = typeof config === "string" ? "drizzle" : config.migrationsSchema ?? "drizzle";
		const migrationTableCreate = sql`
			CREATE TABLE IF NOT EXISTS ${sql.identifier(migrationsSchema)}.${sql.identifier(migrationsTable)} (
				id SERIAL PRIMARY KEY,
				hash text NOT NULL,
				created_at bigint
			)
		`;
		await session$1.execute(sql`CREATE SCHEMA IF NOT EXISTS ${sql.identifier(migrationsSchema)}`);
		await session$1.execute(migrationTableCreate);
		const lastDbMigration = (await session$1.all(sql`select id, hash, created_at from ${sql.identifier(migrationsSchema)}.${sql.identifier(migrationsTable)} order by created_at desc limit 1`))[0];
		await session$1.transaction(async (tx) => {
			for await (const migration of migrations) if (!lastDbMigration || Number(lastDbMigration.created_at) < migration.folderMillis) {
				for (const stmt of migration.sql) await tx.execute(sql.raw(stmt));
				await tx.execute(sql`insert into ${sql.identifier(migrationsSchema)}.${sql.identifier(migrationsTable)} ("hash", "created_at") values(${migration.hash}, ${migration.folderMillis})`);
			}
		});
	}
	escapeName(name) {
		return `"${name.replace(/"/g, "\"\"")}"`;
	}
	escapeParam(num) {
		return `$${num + 1}`;
	}
	escapeString(str) {
		return `'${str.replace(/'/g, "''")}'`;
	}
	buildWithCTE(queries) {
		if (!queries?.length) return void 0;
		const withSqlChunks = [sql`with `];
		for (const [i, w] of queries.entries()) {
			withSqlChunks.push(sql`${sql.identifier(w._.alias)} as (${w._.sql})`);
			if (i < queries.length - 1) withSqlChunks.push(sql`, `);
		}
		withSqlChunks.push(sql` `);
		return sql.join(withSqlChunks);
	}
	buildDeleteQuery({ table, where, returning, withList }) {
		const withSql = this.buildWithCTE(withList);
		const returningSql = returning ? sql` returning ${this.buildSelection(returning, { isSingleTable: true })}` : void 0;
		return sql`${withSql}delete from ${table}${where ? sql` where ${where}` : void 0}${returningSql}`;
	}
	buildUpdateSet(table, set) {
		const tableColumns = table[Table.Symbol.Columns];
		const columnNames = Object.keys(tableColumns).filter((colName) => set[colName] !== void 0 || tableColumns[colName]?.onUpdateFn !== void 0);
		const setSize = columnNames.length;
		return sql.join(columnNames.flatMap((colName, i) => {
			const col = tableColumns[colName];
			const onUpdateFnResult = col.onUpdateFn?.();
			const value = set[colName] ?? (is(onUpdateFnResult, SQL) ? onUpdateFnResult : sql.param(onUpdateFnResult, col));
			const res = sql`${sql.identifier(this.casing.getColumnCasing(col))} = ${value}`;
			if (i < setSize - 1) return [res, sql.raw(", ")];
			return [res];
		}));
	}
	buildUpdateQuery({ table, set, where, returning, withList, from, joins }) {
		const withSql = this.buildWithCTE(withList);
		const tableName = table[PgTable.Symbol.Name];
		const tableSchema = table[PgTable.Symbol.Schema];
		const origTableName = table[PgTable.Symbol.OriginalName];
		const alias = tableName === origTableName ? void 0 : tableName;
		const tableSql = sql`${tableSchema ? sql`${sql.identifier(tableSchema)}.` : void 0}${sql.identifier(origTableName)}${alias && sql` ${sql.identifier(alias)}`}`;
		const setSql = this.buildUpdateSet(table, set);
		const fromSql = from && sql.join([sql.raw(" from "), this.buildFromTable(from)]);
		const joinsSql = this.buildJoins(joins);
		const returningSql = returning ? sql` returning ${this.buildSelection(returning, { isSingleTable: !from })}` : void 0;
		return sql`${withSql}update ${tableSql} set ${setSql}${fromSql}${joinsSql}${where ? sql` where ${where}` : void 0}${returningSql}`;
	}
	/**
	* Builds selection SQL with provided fields/expressions
	*
	* Examples:
	*
	* `select <selection> from`
	*
	* `insert ... returning <selection>`
	*
	* If `isSingleTable` is true, then columns won't be prefixed with table name
	*/
	buildSelection(fields, { isSingleTable = false } = {}) {
		const columnsLen = fields.length;
		const chunks = fields.flatMap(({ field }, i) => {
			const chunk = [];
			if (is(field, SQL.Aliased) && field.isSelectionField) chunk.push(sql.identifier(field.fieldAlias));
			else if (is(field, SQL.Aliased) || is(field, SQL)) {
				const query$1 = is(field, SQL.Aliased) ? field.sql : field;
				if (isSingleTable) chunk.push(new SQL(query$1.queryChunks.map((c) => {
					if (is(c, PgColumn)) return sql.identifier(this.casing.getColumnCasing(c));
					return c;
				})));
				else chunk.push(query$1);
				if (is(field, SQL.Aliased)) chunk.push(sql` as ${sql.identifier(field.fieldAlias)}`);
			} else if (is(field, Column)) if (isSingleTable) chunk.push(sql.identifier(this.casing.getColumnCasing(field)));
			else chunk.push(field);
			else if (is(field, Subquery)) {
				const entries = Object.entries(field._.selectedFields);
				if (entries.length === 1) {
					const entry = entries[0][1];
					const fieldDecoder = is(entry, SQL) ? entry.decoder : is(entry, Column) ? { mapFromDriverValue: (v) => entry.mapFromDriverValue(v) } : entry.sql.decoder;
					if (fieldDecoder) field._.sql.decoder = fieldDecoder;
				}
				chunk.push(field);
			}
			if (i < columnsLen - 1) chunk.push(sql`, `);
			return chunk;
		});
		return sql.join(chunks);
	}
	buildJoins(joins) {
		if (!joins || joins.length === 0) return;
		const joinsArray = [];
		for (const [index$1, joinMeta] of joins.entries()) {
			if (index$1 === 0) joinsArray.push(sql` `);
			const table = joinMeta.table;
			const lateralSql = joinMeta.lateral ? sql` lateral` : void 0;
			const onSql = joinMeta.on ? sql` on ${joinMeta.on}` : void 0;
			if (is(table, PgTable)) {
				const tableName = table[PgTable.Symbol.Name];
				const tableSchema = table[PgTable.Symbol.Schema];
				const origTableName = table[PgTable.Symbol.OriginalName];
				const alias = tableName === origTableName ? void 0 : joinMeta.alias;
				joinsArray.push(sql`${sql.raw(joinMeta.joinType)} join${lateralSql} ${tableSchema ? sql`${sql.identifier(tableSchema)}.` : void 0}${sql.identifier(origTableName)}${alias && sql` ${sql.identifier(alias)}`}${onSql}`);
			} else if (is(table, View)) {
				const viewName = table[ViewBaseConfig].name;
				const viewSchema = table[ViewBaseConfig].schema;
				const origViewName = table[ViewBaseConfig].originalName;
				const alias = viewName === origViewName ? void 0 : joinMeta.alias;
				joinsArray.push(sql`${sql.raw(joinMeta.joinType)} join${lateralSql} ${viewSchema ? sql`${sql.identifier(viewSchema)}.` : void 0}${sql.identifier(origViewName)}${alias && sql` ${sql.identifier(alias)}`}${onSql}`);
			} else joinsArray.push(sql`${sql.raw(joinMeta.joinType)} join${lateralSql} ${table}${onSql}`);
			if (index$1 < joins.length - 1) joinsArray.push(sql` `);
		}
		return sql.join(joinsArray);
	}
	buildFromTable(table) {
		if (is(table, Table) && table[Table.Symbol.IsAlias]) {
			let fullName = sql`${sql.identifier(table[Table.Symbol.OriginalName])}`;
			if (table[Table.Symbol.Schema]) fullName = sql`${sql.identifier(table[Table.Symbol.Schema])}.${fullName}`;
			return sql`${fullName} ${sql.identifier(table[Table.Symbol.Name])}`;
		}
		return table;
	}
	buildSelectQuery({ withList, fields, fieldsFlat, where, having, table, joins, orderBy, groupBy, limit, offset, lockingClause, distinct, setOperators }) {
		const fieldsList = fieldsFlat ?? orderSelectedFields(fields);
		for (const f of fieldsList) if (is(f.field, Column) && getTableName(f.field.table) !== (is(table, Subquery) ? table._.alias : is(table, PgViewBase) ? table[ViewBaseConfig].name : is(table, SQL) ? void 0 : getTableName(table)) && !((table2) => joins?.some(({ alias }) => alias === (table2[Table.Symbol.IsAlias] ? getTableName(table2) : table2[Table.Symbol.BaseName])))(f.field.table)) {
			const tableName = getTableName(f.field.table);
			throw new Error(`Your "${f.path.join("->")}" field references a column "${tableName}"."${f.field.name}", but the table "${tableName}" is not part of the query! Did you forget to join it?`);
		}
		const isSingleTable = !joins || joins.length === 0;
		const withSql = this.buildWithCTE(withList);
		let distinctSql;
		if (distinct) distinctSql = distinct === true ? sql` distinct` : sql` distinct on (${sql.join(distinct.on, sql`, `)})`;
		const selection = this.buildSelection(fieldsList, { isSingleTable });
		const tableSql = this.buildFromTable(table);
		const joinsSql = this.buildJoins(joins);
		const whereSql = where ? sql` where ${where}` : void 0;
		const havingSql = having ? sql` having ${having}` : void 0;
		let orderBySql;
		if (orderBy && orderBy.length > 0) orderBySql = sql` order by ${sql.join(orderBy, sql`, `)}`;
		let groupBySql;
		if (groupBy && groupBy.length > 0) groupBySql = sql` group by ${sql.join(groupBy, sql`, `)}`;
		const limitSql = typeof limit === "object" || typeof limit === "number" && limit >= 0 ? sql` limit ${limit}` : void 0;
		const offsetSql = offset ? sql` offset ${offset}` : void 0;
		const lockingClauseSql = sql.empty();
		if (lockingClause) {
			const clauseSql = sql` for ${sql.raw(lockingClause.strength)}`;
			if (lockingClause.config.of) clauseSql.append(sql` of ${sql.join(Array.isArray(lockingClause.config.of) ? lockingClause.config.of : [lockingClause.config.of], sql`, `)}`);
			if (lockingClause.config.noWait) clauseSql.append(sql` nowait`);
			else if (lockingClause.config.skipLocked) clauseSql.append(sql` skip locked`);
			lockingClauseSql.append(clauseSql);
		}
		const finalQuery = sql`${withSql}select${distinctSql} ${selection} from ${tableSql}${joinsSql}${whereSql}${groupBySql}${havingSql}${orderBySql}${limitSql}${offsetSql}${lockingClauseSql}`;
		if (setOperators.length > 0) return this.buildSetOperations(finalQuery, setOperators);
		return finalQuery;
	}
	buildSetOperations(leftSelect, setOperators) {
		const [setOperator, ...rest] = setOperators;
		if (!setOperator) throw new Error("Cannot pass undefined values to any set operator");
		if (rest.length === 0) return this.buildSetOperationQuery({
			leftSelect,
			setOperator
		});
		return this.buildSetOperations(this.buildSetOperationQuery({
			leftSelect,
			setOperator
		}), rest);
	}
	buildSetOperationQuery({ leftSelect, setOperator: { type, isAll, rightSelect, limit, orderBy, offset } }) {
		const leftChunk = sql`(${leftSelect.getSQL()}) `;
		const rightChunk = sql`(${rightSelect.getSQL()})`;
		let orderBySql;
		if (orderBy && orderBy.length > 0) {
			const orderByValues = [];
			for (const singleOrderBy of orderBy) if (is(singleOrderBy, PgColumn)) orderByValues.push(sql.identifier(singleOrderBy.name));
			else if (is(singleOrderBy, SQL)) {
				for (let i = 0; i < singleOrderBy.queryChunks.length; i++) {
					const chunk = singleOrderBy.queryChunks[i];
					if (is(chunk, PgColumn)) singleOrderBy.queryChunks[i] = sql.identifier(chunk.name);
				}
				orderByValues.push(sql`${singleOrderBy}`);
			} else orderByValues.push(sql`${singleOrderBy}`);
			orderBySql = sql` order by ${sql.join(orderByValues, sql`, `)} `;
		}
		const limitSql = typeof limit === "object" || typeof limit === "number" && limit >= 0 ? sql` limit ${limit}` : void 0;
		const operatorChunk = sql.raw(`${type} ${isAll ? "all " : ""}`);
		const offsetSql = offset ? sql` offset ${offset}` : void 0;
		return sql`${leftChunk}${operatorChunk}${rightChunk}${orderBySql}${limitSql}${offsetSql}`;
	}
	buildInsertQuery({ table, values: valuesOrSelect, onConflict, returning, withList, select, overridingSystemValue_ }) {
		const valuesSqlList = [];
		const columns = table[Table.Symbol.Columns];
		const colEntries = Object.entries(columns).filter(([_, col]) => !col.shouldDisableInsert());
		const insertOrder = colEntries.map(([, column]) => sql.identifier(this.casing.getColumnCasing(column)));
		if (select) {
			const select2 = valuesOrSelect;
			if (is(select2, SQL)) valuesSqlList.push(select2);
			else valuesSqlList.push(select2.getSQL());
		} else {
			const values = valuesOrSelect;
			valuesSqlList.push(sql.raw("values "));
			for (const [valueIndex, value] of values.entries()) {
				const valueList = [];
				for (const [fieldName, col] of colEntries) {
					const colValue = value[fieldName];
					if (colValue === void 0 || is(colValue, Param) && colValue.value === void 0) if (col.defaultFn !== void 0) {
						const defaultFnResult = col.defaultFn();
						const defaultValue = is(defaultFnResult, SQL) ? defaultFnResult : sql.param(defaultFnResult, col);
						valueList.push(defaultValue);
					} else if (!col.default && col.onUpdateFn !== void 0) {
						const onUpdateFnResult = col.onUpdateFn();
						const newValue = is(onUpdateFnResult, SQL) ? onUpdateFnResult : sql.param(onUpdateFnResult, col);
						valueList.push(newValue);
					} else valueList.push(sql`default`);
					else valueList.push(colValue);
				}
				valuesSqlList.push(valueList);
				if (valueIndex < values.length - 1) valuesSqlList.push(sql`, `);
			}
		}
		const withSql = this.buildWithCTE(withList);
		const valuesSql = sql.join(valuesSqlList);
		const returningSql = returning ? sql` returning ${this.buildSelection(returning, { isSingleTable: true })}` : void 0;
		const onConflictSql = onConflict ? sql` on conflict ${onConflict}` : void 0;
		return sql`${withSql}insert into ${table} ${insertOrder} ${overridingSystemValue_ === true ? sql`overriding system value ` : void 0}${valuesSql}${onConflictSql}${returningSql}`;
	}
	buildRefreshMaterializedViewQuery({ view, concurrently, withNoData }) {
		return sql`refresh materialized view${concurrently ? sql` concurrently` : void 0} ${view}${withNoData ? sql` with no data` : void 0}`;
	}
	prepareTyping(encoder) {
		if (is(encoder, PgJsonb) || is(encoder, PgJson)) return "json";
		else if (is(encoder, PgNumeric)) return "decimal";
		else if (is(encoder, PgTime)) return "time";
		else if (is(encoder, PgTimestamp) || is(encoder, PgTimestampString)) return "timestamp";
		else if (is(encoder, PgDate) || is(encoder, PgDateString)) return "date";
		else if (is(encoder, PgUUID)) return "uuid";
		else return "none";
	}
	sqlToQuery(sql2, invokeSource) {
		return sql2.toQuery({
			casing: this.casing,
			escapeName: this.escapeName,
			escapeParam: this.escapeParam,
			escapeString: this.escapeString,
			prepareTyping: this.prepareTyping,
			invokeSource
		});
	}
	buildRelationalQueryWithoutPK({ fullSchema, schema, tableNamesMap, table, tableConfig, queryConfig: config, tableAlias, nestedQueryRelation, joinOn }) {
		let selection = [];
		let limit, offset, orderBy = [], where;
		const joins = [];
		if (config === true) selection = Object.entries(tableConfig.columns).map(([key, value]) => ({
			dbKey: value.name,
			tsKey: key,
			field: aliasedTableColumn(value, tableAlias),
			relationTableTsKey: void 0,
			isJson: false,
			selection: []
		}));
		else {
			const aliasedColumns = Object.fromEntries(Object.entries(tableConfig.columns).map(([key, value]) => [key, aliasedTableColumn(value, tableAlias)]));
			if (config.where) {
				const whereSql = typeof config.where === "function" ? config.where(aliasedColumns, getOperators()) : config.where;
				where = whereSql && mapColumnsInSQLToAlias(whereSql, tableAlias);
			}
			const fieldsSelection = [];
			let selectedColumns = [];
			if (config.columns) {
				let isIncludeMode = false;
				for (const [field, value] of Object.entries(config.columns)) {
					if (value === void 0) continue;
					if (field in tableConfig.columns) {
						if (!isIncludeMode && value === true) isIncludeMode = true;
						selectedColumns.push(field);
					}
				}
				if (selectedColumns.length > 0) selectedColumns = isIncludeMode ? selectedColumns.filter((c) => config.columns?.[c] === true) : Object.keys(tableConfig.columns).filter((key) => !selectedColumns.includes(key));
			} else selectedColumns = Object.keys(tableConfig.columns);
			for (const field of selectedColumns) {
				const column = tableConfig.columns[field];
				fieldsSelection.push({
					tsKey: field,
					value: column
				});
			}
			let selectedRelations = [];
			if (config.with) selectedRelations = Object.entries(config.with).filter((entry) => !!entry[1]).map(([tsKey, queryConfig]) => ({
				tsKey,
				queryConfig,
				relation: tableConfig.relations[tsKey]
			}));
			let extras;
			if (config.extras) {
				extras = typeof config.extras === "function" ? config.extras(aliasedColumns, { sql }) : config.extras;
				for (const [tsKey, value] of Object.entries(extras)) fieldsSelection.push({
					tsKey,
					value: mapColumnsInAliasedSQLToAlias(value, tableAlias)
				});
			}
			for (const { tsKey, value } of fieldsSelection) selection.push({
				dbKey: is(value, SQL.Aliased) ? value.fieldAlias : tableConfig.columns[tsKey].name,
				tsKey,
				field: is(value, Column) ? aliasedTableColumn(value, tableAlias) : value,
				relationTableTsKey: void 0,
				isJson: false,
				selection: []
			});
			let orderByOrig = typeof config.orderBy === "function" ? config.orderBy(aliasedColumns, getOrderByOperators()) : config.orderBy ?? [];
			if (!Array.isArray(orderByOrig)) orderByOrig = [orderByOrig];
			orderBy = orderByOrig.map((orderByValue) => {
				if (is(orderByValue, Column)) return aliasedTableColumn(orderByValue, tableAlias);
				return mapColumnsInSQLToAlias(orderByValue, tableAlias);
			});
			limit = config.limit;
			offset = config.offset;
			for (const { tsKey: selectedRelationTsKey, queryConfig: selectedRelationConfigValue, relation } of selectedRelations) {
				const normalizedRelation = normalizeRelation(schema, tableNamesMap, relation);
				const relationTableTsName = tableNamesMap[getTableUniqueName(relation.referencedTable)];
				const relationTableAlias = `${tableAlias}_${selectedRelationTsKey}`;
				const joinOn2 = and(...normalizedRelation.fields.map((field2, i) => eq(aliasedTableColumn(normalizedRelation.references[i], relationTableAlias), aliasedTableColumn(field2, tableAlias))));
				const builtRelation = this.buildRelationalQueryWithoutPK({
					fullSchema,
					schema,
					tableNamesMap,
					table: fullSchema[relationTableTsName],
					tableConfig: schema[relationTableTsName],
					queryConfig: is(relation, One) ? selectedRelationConfigValue === true ? { limit: 1 } : {
						...selectedRelationConfigValue,
						limit: 1
					} : selectedRelationConfigValue,
					tableAlias: relationTableAlias,
					joinOn: joinOn2,
					nestedQueryRelation: relation
				});
				const field = sql`${sql.identifier(relationTableAlias)}.${sql.identifier("data")}`.as(selectedRelationTsKey);
				joins.push({
					on: sql`true`,
					table: new Subquery(builtRelation.sql, {}, relationTableAlias),
					alias: relationTableAlias,
					joinType: "left",
					lateral: true
				});
				selection.push({
					dbKey: selectedRelationTsKey,
					tsKey: selectedRelationTsKey,
					field,
					relationTableTsKey: relationTableTsName,
					isJson: true,
					selection: builtRelation.selection
				});
			}
		}
		if (selection.length === 0) throw new DrizzleError({ message: `No fields selected for table "${tableConfig.tsName}" ("${tableAlias}")` });
		let result;
		where = and(joinOn, where);
		if (nestedQueryRelation) {
			let field = sql`json_build_array(${sql.join(selection.map(({ field: field2, tsKey, isJson }) => isJson ? sql`${sql.identifier(`${tableAlias}_${tsKey}`)}.${sql.identifier("data")}` : is(field2, SQL.Aliased) ? field2.sql : field2), sql`, `)})`;
			if (is(nestedQueryRelation, Many)) field = sql`coalesce(json_agg(${field}${orderBy.length > 0 ? sql` order by ${sql.join(orderBy, sql`, `)}` : void 0}), '[]'::json)`;
			const nestedSelection = [{
				dbKey: "data",
				tsKey: "data",
				field: field.as("data"),
				isJson: true,
				relationTableTsKey: tableConfig.tsName,
				selection
			}];
			if (limit !== void 0 || offset !== void 0 || orderBy.length > 0) {
				result = this.buildSelectQuery({
					table: aliasedTable(table, tableAlias),
					fields: {},
					fieldsFlat: [{
						path: [],
						field: sql.raw("*")
					}],
					where,
					limit,
					offset,
					orderBy,
					setOperators: []
				});
				where = void 0;
				limit = void 0;
				offset = void 0;
				orderBy = [];
			} else result = aliasedTable(table, tableAlias);
			result = this.buildSelectQuery({
				table: is(result, PgTable) ? result : new Subquery(result, {}, tableAlias),
				fields: {},
				fieldsFlat: nestedSelection.map(({ field: field2 }) => ({
					path: [],
					field: is(field2, Column) ? aliasedTableColumn(field2, tableAlias) : field2
				})),
				joins,
				where,
				limit,
				offset,
				orderBy,
				setOperators: []
			});
		} else result = this.buildSelectQuery({
			table: aliasedTable(table, tableAlias),
			fields: {},
			fieldsFlat: selection.map(({ field }) => ({
				path: [],
				field: is(field, Column) ? aliasedTableColumn(field, tableAlias) : field
			})),
			joins,
			where,
			limit,
			offset,
			orderBy,
			setOperators: []
		});
		return {
			tableTsKey: tableConfig.tsName,
			sql: result,
			selection
		};
	}
};

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/query-builders/query-builder.js
var TypedQueryBuilder = class {
	static [entityKind] = "TypedQueryBuilder";
	/** @internal */
	getSelectedFields() {
		return this._.selectedFields;
	}
};

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/pg-core/query-builders/select.js
var PgSelectBuilder = class {
	static [entityKind] = "PgSelectBuilder";
	fields;
	session;
	dialect;
	withList = [];
	distinct;
	constructor(config) {
		this.fields = config.fields;
		this.session = config.session;
		this.dialect = config.dialect;
		if (config.withList) this.withList = config.withList;
		this.distinct = config.distinct;
	}
	authToken;
	/** @internal */
	setToken(token) {
		this.authToken = token;
		return this;
	}
	/**
	* Specify the table, subquery, or other target that you're
	* building a select query against.
	*
	* {@link https://www.postgresql.org/docs/current/sql-select.html#SQL-FROM | Postgres from documentation}
	*/
	from(source) {
		const isPartialSelect = !!this.fields;
		const src = source;
		let fields;
		if (this.fields) fields = this.fields;
		else if (is(src, Subquery)) fields = Object.fromEntries(Object.keys(src._.selectedFields).map((key) => [key, src[key]]));
		else if (is(src, PgViewBase)) fields = src[ViewBaseConfig].selectedFields;
		else if (is(src, SQL)) fields = {};
		else fields = getTableColumns(src);
		return new PgSelectBase({
			table: src,
			fields,
			isPartialSelect,
			session: this.session,
			dialect: this.dialect,
			withList: this.withList,
			distinct: this.distinct
		}).setToken(this.authToken);
	}
};
var PgSelectQueryBuilderBase = class extends TypedQueryBuilder {
	static [entityKind] = "PgSelectQueryBuilder";
	_;
	config;
	joinsNotNullableMap;
	tableName;
	isPartialSelect;
	session;
	dialect;
	cacheConfig = void 0;
	usedTables = /* @__PURE__ */ new Set();
	constructor({ table, fields, isPartialSelect, session: session$1, dialect, withList, distinct }) {
		super();
		this.config = {
			withList,
			table,
			fields: { ...fields },
			distinct,
			setOperators: []
		};
		this.isPartialSelect = isPartialSelect;
		this.session = session$1;
		this.dialect = dialect;
		this._ = {
			selectedFields: fields,
			config: this.config
		};
		this.tableName = getTableLikeName(table);
		this.joinsNotNullableMap = typeof this.tableName === "string" ? { [this.tableName]: true } : {};
		for (const item of extractUsedTable(table)) this.usedTables.add(item);
	}
	/** @internal */
	getUsedTables() {
		return [...this.usedTables];
	}
	createJoin(joinType, lateral) {
		return (table, on) => {
			const baseTableName = this.tableName;
			const tableName = getTableLikeName(table);
			for (const item of extractUsedTable(table)) this.usedTables.add(item);
			if (typeof tableName === "string" && this.config.joins?.some((join) => join.alias === tableName)) throw new Error(`Alias "${tableName}" is already used in this query`);
			if (!this.isPartialSelect) {
				if (Object.keys(this.joinsNotNullableMap).length === 1 && typeof baseTableName === "string") this.config.fields = { [baseTableName]: this.config.fields };
				if (typeof tableName === "string" && !is(table, SQL)) {
					const selection = is(table, Subquery) ? table._.selectedFields : is(table, View) ? table[ViewBaseConfig].selectedFields : table[Table.Symbol.Columns];
					this.config.fields[tableName] = selection;
				}
			}
			if (typeof on === "function") on = on(new Proxy(this.config.fields, new SelectionProxyHandler({
				sqlAliasedBehavior: "sql",
				sqlBehavior: "sql"
			})));
			if (!this.config.joins) this.config.joins = [];
			this.config.joins.push({
				on,
				table,
				joinType,
				alias: tableName,
				lateral
			});
			if (typeof tableName === "string") switch (joinType) {
				case "left":
					this.joinsNotNullableMap[tableName] = false;
					break;
				case "right":
					this.joinsNotNullableMap = Object.fromEntries(Object.entries(this.joinsNotNullableMap).map(([key]) => [key, false]));
					this.joinsNotNullableMap[tableName] = true;
					break;
				case "cross":
				case "inner":
					this.joinsNotNullableMap[tableName] = true;
					break;
				case "full":
					this.joinsNotNullableMap = Object.fromEntries(Object.entries(this.joinsNotNullableMap).map(([key]) => [key, false]));
					this.joinsNotNullableMap[tableName] = false;
					break;
			}
			return this;
		};
	}
	/**
	* Executes a `left join` operation by adding another table to the current query.
	*
	* Calling this method associates each row of the table with the corresponding row from the joined table, if a match is found. If no matching row exists, it sets all columns of the joined table to null.
	*
	* See docs: {@link https://orm.drizzle.team/docs/joins#left-join}
	*
	* @param table the table to join.
	* @param on the `on` clause.
	*
	* @example
	*
	* ```ts
	* // Select all users and their pets
	* const usersWithPets: { user: User; pets: Pet | null; }[] = await db.select()
	*   .from(users)
	*   .leftJoin(pets, eq(users.id, pets.ownerId))
	*
	* // Select userId and petId
	* const usersIdsAndPetIds: { userId: number; petId: number | null; }[] = await db.select({
	*   userId: users.id,
	*   petId: pets.id,
	* })
	*   .from(users)
	*   .leftJoin(pets, eq(users.id, pets.ownerId))
	* ```
	*/
	leftJoin = this.createJoin("left", false);
	/**
	* Executes a `left join lateral` operation by adding subquery to the current query.
	*
	* A `lateral` join allows the right-hand expression to refer to columns from the left-hand side.
	*
	* Calling this method associates each row of the table with the corresponding row from the joined table, if a match is found. If no matching row exists, it sets all columns of the joined table to null.
	*
	* See docs: {@link https://orm.drizzle.team/docs/joins#left-join-lateral}
	*
	* @param table the subquery to join.
	* @param on the `on` clause.
	*/
	leftJoinLateral = this.createJoin("left", true);
	/**
	* Executes a `right join` operation by adding another table to the current query.
	*
	* Calling this method associates each row of the joined table with the corresponding row from the main table, if a match is found. If no matching row exists, it sets all columns of the main table to null.
	*
	* See docs: {@link https://orm.drizzle.team/docs/joins#right-join}
	*
	* @param table the table to join.
	* @param on the `on` clause.
	*
	* @example
	*
	* ```ts
	* // Select all users and their pets
	* const usersWithPets: { user: User | null; pets: Pet; }[] = await db.select()
	*   .from(users)
	*   .rightJoin(pets, eq(users.id, pets.ownerId))
	*
	* // Select userId and petId
	* const usersIdsAndPetIds: { userId: number | null; petId: number; }[] = await db.select({
	*   userId: users.id,
	*   petId: pets.id,
	* })
	*   .from(users)
	*   .rightJoin(pets, eq(users.id, pets.ownerId))
	* ```
	*/
	rightJoin = this.createJoin("right", false);
	/**
	* Executes an `inner join` operation, creating a new table by combining rows from two tables that have matching values.
	*
	* Calling this method retrieves rows that have corresponding entries in both joined tables. Rows without matching entries in either table are excluded, resulting in a table that includes only matching pairs.
	*
	* See docs: {@link https://orm.drizzle.team/docs/joins#inner-join}
	*
	* @param table the table to join.
	* @param on the `on` clause.
	*
	* @example
	*
	* ```ts
	* // Select all users and their pets
	* const usersWithPets: { user: User; pets: Pet; }[] = await db.select()
	*   .from(users)
	*   .innerJoin(pets, eq(users.id, pets.ownerId))
	*
	* // Select userId and petId
	* const usersIdsAndPetIds: { userId: number; petId: number; }[] = await db.select({
	*   userId: users.id,
	*   petId: pets.id,
	* })
	*   .from(users)
	*   .innerJoin(pets, eq(users.id, pets.ownerId))
	* ```
	*/
	innerJoin = this.createJoin("inner", false);
	/**
	* Executes an `inner join lateral` operation, creating a new table by combining rows from two queries that have matching values.
	*
	* A `lateral` join allows the right-hand expression to refer to columns from the left-hand side.
	*
	* Calling this method retrieves rows that have corresponding entries in both joined tables. Rows without matching entries in either table are excluded, resulting in a table that includes only matching pairs.
	*
	* See docs: {@link https://orm.drizzle.team/docs/joins#inner-join-lateral}
	*
	* @param table the subquery to join.
	* @param on the `on` clause.
	*/
	innerJoinLateral = this.createJoin("inner", true);
	/**
	* Executes a `full join` operation by combining rows from two tables into a new table.
	*
	* Calling this method retrieves all rows from both main and joined tables, merging rows with matching values and filling in `null` for non-matching columns.
	*
	* See docs: {@link https://orm.drizzle.team/docs/joins#full-join}
	*
	* @param table the table to join.
	* @param on the `on` clause.
	*
	* @example
	*
	* ```ts
	* // Select all users and their pets
	* const usersWithPets: { user: User | null; pets: Pet | null; }[] = await db.select()
	*   .from(users)
	*   .fullJoin(pets, eq(users.id, pets.ownerId))
	*
	* // Select userId and petId
	* const usersIdsAndPetIds: { userId: number | null; petId: number | null; }[] = await db.select({
	*   userId: users.id,
	*   petId: pets.id,
	* })
	*   .from(users)
	*   .fullJoin(pets, eq(users.id, pets.ownerId))
	* ```
	*/
	fullJoin = this.createJoin("full", false);
	/**
	* Executes a `cross join` operation by combining rows from two tables into a new table.
	*
	* Calling this method retrieves all rows from both main and joined tables, merging all rows from each table.
	*
	* See docs: {@link https://orm.drizzle.team/docs/joins#cross-join}
	*
	* @param table the table to join.
	*
	* @example
	*
	* ```ts
	* // Select all users, each user with every pet
	* const usersWithPets: { user: User; pets: Pet; }[] = await db.select()
	*   .from(users)
	*   .crossJoin(pets)
	*
	* // Select userId and petId
	* const usersIdsAndPetIds: { userId: number; petId: number; }[] = await db.select({
	*   userId: users.id,
	*   petId: pets.id,
	* })
	*   .from(users)
	*   .crossJoin(pets)
	* ```
	*/
	crossJoin = this.createJoin("cross", false);
	/**
	* Executes a `cross join lateral` operation by combining rows from two queries into a new table.
	*
	* A `lateral` join allows the right-hand expression to refer to columns from the left-hand side.
	*
	* Calling this method retrieves all rows from both main and joined queries, merging all rows from each query.
	*
	* See docs: {@link https://orm.drizzle.team/docs/joins#cross-join-lateral}
	*
	* @param table the query to join.
	*/
	crossJoinLateral = this.createJoin("cross", true);
	createSetOperator(type, isAll) {
		return (rightSelection) => {
			const rightSelect = typeof rightSelection === "function" ? rightSelection(getPgSetOperators()) : rightSelection;
			if (!haveSameKeys(this.getSelectedFields(), rightSelect.getSelectedFields())) throw new Error("Set operator error (union / intersect / except): selected fields are not the same or are in a different order");
			this.config.setOperators.push({
				type,
				isAll,
				rightSelect
			});
			return this;
		};
	}
	/**
	* Adds `union` set operator to the query.
	*
	* Calling this method will combine the result sets of the `select` statements and remove any duplicate rows that appear across them.
	*
	* See docs: {@link https://orm.drizzle.team/docs/set-operations#union}
	*
	* @example
	*
	* ```ts
	* // Select all unique names from customers and users tables
	* await db.select({ name: users.name })
	*   .from(users)
	*   .union(
	*     db.select({ name: customers.name }).from(customers)
	*   );
	* // or
	* import { union } from 'drizzle-orm/pg-core'
	*
	* await union(
	*   db.select({ name: users.name }).from(users),
	*   db.select({ name: customers.name }).from(customers)
	* );
	* ```
	*/
	union = this.createSetOperator("union", false);
	/**
	* Adds `union all` set operator to the query.
	*
	* Calling this method will combine the result-set of the `select` statements and keep all duplicate rows that appear across them.
	*
	* See docs: {@link https://orm.drizzle.team/docs/set-operations#union-all}
	*
	* @example
	*
	* ```ts
	* // Select all transaction ids from both online and in-store sales
	* await db.select({ transaction: onlineSales.transactionId })
	*   .from(onlineSales)
	*   .unionAll(
	*     db.select({ transaction: inStoreSales.transactionId }).from(inStoreSales)
	*   );
	* // or
	* import { unionAll } from 'drizzle-orm/pg-core'
	*
	* await unionAll(
	*   db.select({ transaction: onlineSales.transactionId }).from(onlineSales),
	*   db.select({ transaction: inStoreSales.transactionId }).from(inStoreSales)
	* );
	* ```
	*/
	unionAll = this.createSetOperator("union", true);
	/**
	* Adds `intersect` set operator to the query.
	*
	* Calling this method will retain only the rows that are present in both result sets and eliminate duplicates.
	*
	* See docs: {@link https://orm.drizzle.team/docs/set-operations#intersect}
	*
	* @example
	*
	* ```ts
	* // Select course names that are offered in both departments A and B
	* await db.select({ courseName: depA.courseName })
	*   .from(depA)
	*   .intersect(
	*     db.select({ courseName: depB.courseName }).from(depB)
	*   );
	* // or
	* import { intersect } from 'drizzle-orm/pg-core'
	*
	* await intersect(
	*   db.select({ courseName: depA.courseName }).from(depA),
	*   db.select({ courseName: depB.courseName }).from(depB)
	* );
	* ```
	*/
	intersect = this.createSetOperator("intersect", false);
	/**
	* Adds `intersect all` set operator to the query.
	*
	* Calling this method will retain only the rows that are present in both result sets including all duplicates.
	*
	* See docs: {@link https://orm.drizzle.team/docs/set-operations#intersect-all}
	*
	* @example
	*
	* ```ts
	* // Select all products and quantities that are ordered by both regular and VIP customers
	* await db.select({
	*   productId: regularCustomerOrders.productId,
	*   quantityOrdered: regularCustomerOrders.quantityOrdered
	* })
	* .from(regularCustomerOrders)
	* .intersectAll(
	*   db.select({
	*     productId: vipCustomerOrders.productId,
	*     quantityOrdered: vipCustomerOrders.quantityOrdered
	*   })
	*   .from(vipCustomerOrders)
	* );
	* // or
	* import { intersectAll } from 'drizzle-orm/pg-core'
	*
	* await intersectAll(
	*   db.select({
	*     productId: regularCustomerOrders.productId,
	*     quantityOrdered: regularCustomerOrders.quantityOrdered
	*   })
	*   .from(regularCustomerOrders),
	*   db.select({
	*     productId: vipCustomerOrders.productId,
	*     quantityOrdered: vipCustomerOrders.quantityOrdered
	*   })
	*   .from(vipCustomerOrders)
	* );
	* ```
	*/
	intersectAll = this.createSetOperator("intersect", true);
	/**
	* Adds `except` set operator to the query.
	*
	* Calling this method will retrieve all unique rows from the left query, except for the rows that are present in the result set of the right query.
	*
	* See docs: {@link https://orm.drizzle.team/docs/set-operations#except}
	*
	* @example
	*
	* ```ts
	* // Select all courses offered in department A but not in department B
	* await db.select({ courseName: depA.courseName })
	*   .from(depA)
	*   .except(
	*     db.select({ courseName: depB.courseName }).from(depB)
	*   );
	* // or
	* import { except } from 'drizzle-orm/pg-core'
	*
	* await except(
	*   db.select({ courseName: depA.courseName }).from(depA),
	*   db.select({ courseName: depB.courseName }).from(depB)
	* );
	* ```
	*/
	except = this.createSetOperator("except", false);
	/**
	* Adds `except all` set operator to the query.
	*
	* Calling this method will retrieve all rows from the left query, except for the rows that are present in the result set of the right query.
	*
	* See docs: {@link https://orm.drizzle.team/docs/set-operations#except-all}
	*
	* @example
	*
	* ```ts
	* // Select all products that are ordered by regular customers but not by VIP customers
	* await db.select({
	*   productId: regularCustomerOrders.productId,
	*   quantityOrdered: regularCustomerOrders.quantityOrdered,
	* })
	* .from(regularCustomerOrders)
	* .exceptAll(
	*   db.select({
	*     productId: vipCustomerOrders.productId,
	*     quantityOrdered: vipCustomerOrders.quantityOrdered,
	*   })
	*   .from(vipCustomerOrders)
	* );
	* // or
	* import { exceptAll } from 'drizzle-orm/pg-core'
	*
	* await exceptAll(
	*   db.select({
	*     productId: regularCustomerOrders.productId,
	*     quantityOrdered: regularCustomerOrders.quantityOrdered
	*   })
	*   .from(regularCustomerOrders),
	*   db.select({
	*     productId: vipCustomerOrders.productId,
	*     quantityOrdered: vipCustomerOrders.quantityOrdered
	*   })
	*   .from(vipCustomerOrders)
	* );
	* ```
	*/
	exceptAll = this.createSetOperator("except", true);
	/** @internal */
	addSetOperators(setOperators) {
		this.config.setOperators.push(...setOperators);
		return this;
	}
	/**
	* Adds a `where` clause to the query.
	*
	* Calling this method will select only those rows that fulfill a specified condition.
	*
	* See docs: {@link https://orm.drizzle.team/docs/select#filtering}
	*
	* @param where the `where` clause.
	*
	* @example
	* You can use conditional operators and `sql function` to filter the rows to be selected.
	*
	* ```ts
	* // Select all cars with green color
	* await db.select().from(cars).where(eq(cars.color, 'green'));
	* // or
	* await db.select().from(cars).where(sql`${cars.color} = 'green'`)
	* ```
	*
	* You can logically combine conditional operators with `and()` and `or()` operators:
	*
	* ```ts
	* // Select all BMW cars with a green color
	* await db.select().from(cars).where(and(eq(cars.color, 'green'), eq(cars.brand, 'BMW')));
	*
	* // Select all cars with the green or blue color
	* await db.select().from(cars).where(or(eq(cars.color, 'green'), eq(cars.color, 'blue')));
	* ```
	*/
	where(where) {
		if (typeof where === "function") where = where(new Proxy(this.config.fields, new SelectionProxyHandler({
			sqlAliasedBehavior: "sql",
			sqlBehavior: "sql"
		})));
		this.config.where = where;
		return this;
	}
	/**
	* Adds a `having` clause to the query.
	*
	* Calling this method will select only those rows that fulfill a specified condition. It is typically used with aggregate functions to filter the aggregated data based on a specified condition.
	*
	* See docs: {@link https://orm.drizzle.team/docs/select#aggregations}
	*
	* @param having the `having` clause.
	*
	* @example
	*
	* ```ts
	* // Select all brands with more than one car
	* await db.select({
	* 	brand: cars.brand,
	* 	count: sql<number>`cast(count(${cars.id}) as int)`,
	* })
	*   .from(cars)
	*   .groupBy(cars.brand)
	*   .having(({ count }) => gt(count, 1));
	* ```
	*/
	having(having) {
		if (typeof having === "function") having = having(new Proxy(this.config.fields, new SelectionProxyHandler({
			sqlAliasedBehavior: "sql",
			sqlBehavior: "sql"
		})));
		this.config.having = having;
		return this;
	}
	groupBy(...columns) {
		if (typeof columns[0] === "function") {
			const groupBy = columns[0](new Proxy(this.config.fields, new SelectionProxyHandler({
				sqlAliasedBehavior: "alias",
				sqlBehavior: "sql"
			})));
			this.config.groupBy = Array.isArray(groupBy) ? groupBy : [groupBy];
		} else this.config.groupBy = columns;
		return this;
	}
	orderBy(...columns) {
		if (typeof columns[0] === "function") {
			const orderBy = columns[0](new Proxy(this.config.fields, new SelectionProxyHandler({
				sqlAliasedBehavior: "alias",
				sqlBehavior: "sql"
			})));
			const orderByArray = Array.isArray(orderBy) ? orderBy : [orderBy];
			if (this.config.setOperators.length > 0) this.config.setOperators.at(-1).orderBy = orderByArray;
			else this.config.orderBy = orderByArray;
		} else {
			const orderByArray = columns;
			if (this.config.setOperators.length > 0) this.config.setOperators.at(-1).orderBy = orderByArray;
			else this.config.orderBy = orderByArray;
		}
		return this;
	}
	/**
	* Adds a `limit` clause to the query.
	*
	* Calling this method will set the maximum number of rows that will be returned by this query.
	*
	* See docs: {@link https://orm.drizzle.team/docs/select#limit--offset}
	*
	* @param limit the `limit` clause.
	*
	* @example
	*
	* ```ts
	* // Get the first 10 people from this query.
	* await db.select().from(people).limit(10);
	* ```
	*/
	limit(limit) {
		if (this.config.setOperators.length > 0) this.config.setOperators.at(-1).limit = limit;
		else this.config.limit = limit;
		return this;
	}
	/**
	* Adds an `offset` clause to the query.
	*
	* Calling this method will skip a number of rows when returning results from this query.
	*
	* See docs: {@link https://orm.drizzle.team/docs/select#limit--offset}
	*
	* @param offset the `offset` clause.
	*
	* @example
	*
	* ```ts
	* // Get the 10th-20th people from this query.
	* await db.select().from(people).offset(10).limit(10);
	* ```
	*/
	offset(offset) {
		if (this.config.setOperators.length > 0) this.config.setOperators.at(-1).offset = offset;
		else this.config.offset = offset;
		return this;
	}
	/**
	* Adds a `for` clause to the query.
	*
	* Calling this method will specify a lock strength for this query that controls how strictly it acquires exclusive access to the rows being queried.
	*
	* See docs: {@link https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE}
	*
	* @param strength the lock strength.
	* @param config the lock configuration.
	*/
	for(strength, config = {}) {
		this.config.lockingClause = {
			strength,
			config
		};
		return this;
	}
	/** @internal */
	getSQL() {
		return this.dialect.buildSelectQuery(this.config);
	}
	toSQL() {
		const { typings: _typings, ...rest } = this.dialect.sqlToQuery(this.getSQL());
		return rest;
	}
	as(alias) {
		const usedTables = [];
		usedTables.push(...extractUsedTable(this.config.table));
		if (this.config.joins) for (const it of this.config.joins) usedTables.push(...extractUsedTable(it.table));
		return new Proxy(new Subquery(this.getSQL(), this.config.fields, alias, false, [...new Set(usedTables)]), new SelectionProxyHandler({
			alias,
			sqlAliasedBehavior: "alias",
			sqlBehavior: "error"
		}));
	}
	/** @internal */
	getSelectedFields() {
		return new Proxy(this.config.fields, new SelectionProxyHandler({
			alias: this.tableName,
			sqlAliasedBehavior: "alias",
			sqlBehavior: "error"
		}));
	}
	$dynamic() {
		return this;
	}
	$withCache(config) {
		this.cacheConfig = config === void 0 ? {
			config: {},
			enable: true,
			autoInvalidate: true
		} : config === false ? { enable: false } : {
			enable: true,
			autoInvalidate: true,
			...config
		};
		return this;
	}
};
var PgSelectBase = class extends PgSelectQueryBuilderBase {
	static [entityKind] = "PgSelect";
	/** @internal */
	_prepare(name) {
		const { session: session$1, config, dialect, joinsNotNullableMap, authToken, cacheConfig, usedTables } = this;
		if (!session$1) throw new Error("Cannot execute a query on a query builder. Please use a database instance instead.");
		const { fields } = config;
		return tracer.startActiveSpan("drizzle.prepareQuery", () => {
			const fieldsList = orderSelectedFields(fields);
			const query$1 = session$1.prepareQuery(dialect.sqlToQuery(this.getSQL()), fieldsList, name, true, void 0, {
				type: "select",
				tables: [...usedTables]
			}, cacheConfig);
			query$1.joinsNotNullableMap = joinsNotNullableMap;
			return query$1.setToken(authToken);
		});
	}
	/**
	* Create a prepared statement for this query. This allows
	* the database to remember this query for the given session
	* and call it by name, rather than specifying the full query.
	*
	* {@link https://www.postgresql.org/docs/current/sql-prepare.html | Postgres prepare documentation}
	*/
	prepare(name) {
		return this._prepare(name);
	}
	authToken;
	/** @internal */
	setToken(token) {
		this.authToken = token;
		return this;
	}
	execute = (placeholderValues) => {
		return tracer.startActiveSpan("drizzle.operation", () => {
			return this._prepare().execute(placeholderValues, this.authToken);
		});
	};
};
applyMixins(PgSelectBase, [QueryPromise]);
function createSetOperator(type, isAll) {
	return (leftSelect, rightSelect, ...restSelects) => {
		const setOperators = [rightSelect, ...restSelects].map((select) => ({
			type,
			isAll,
			rightSelect: select
		}));
		for (const setOperator of setOperators) if (!haveSameKeys(leftSelect.getSelectedFields(), setOperator.rightSelect.getSelectedFields())) throw new Error("Set operator error (union / intersect / except): selected fields are not the same or are in a different order");
		return leftSelect.addSetOperators(setOperators);
	};
}
const getPgSetOperators = () => ({
	union,
	unionAll,
	intersect,
	intersectAll,
	except,
	exceptAll
});
const union = createSetOperator("union", false);
const unionAll = createSetOperator("union", true);
const intersect = createSetOperator("intersect", false);
const intersectAll = createSetOperator("intersect", true);
const except = createSetOperator("except", false);
const exceptAll = createSetOperator("except", true);

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/pg-core/query-builders/query-builder.js
var QueryBuilder = class {
	static [entityKind] = "PgQueryBuilder";
	dialect;
	dialectConfig;
	constructor(dialect) {
		this.dialect = is(dialect, PgDialect) ? dialect : void 0;
		this.dialectConfig = is(dialect, PgDialect) ? void 0 : dialect;
	}
	$with = (alias, selection) => {
		const queryBuilder = this;
		const as = (qb) => {
			if (typeof qb === "function") qb = qb(queryBuilder);
			return new Proxy(new WithSubquery(qb.getSQL(), selection ?? ("getSelectedFields" in qb ? qb.getSelectedFields() ?? {} : {}), alias, true), new SelectionProxyHandler({
				alias,
				sqlAliasedBehavior: "alias",
				sqlBehavior: "error"
			}));
		};
		return { as };
	};
	with(...queries) {
		const self = this;
		function select(fields) {
			return new PgSelectBuilder({
				fields: fields ?? void 0,
				session: void 0,
				dialect: self.getDialect(),
				withList: queries
			});
		}
		function selectDistinct(fields) {
			return new PgSelectBuilder({
				fields: fields ?? void 0,
				session: void 0,
				dialect: self.getDialect(),
				distinct: true
			});
		}
		function selectDistinctOn(on, fields) {
			return new PgSelectBuilder({
				fields: fields ?? void 0,
				session: void 0,
				dialect: self.getDialect(),
				distinct: { on }
			});
		}
		return {
			select,
			selectDistinct,
			selectDistinctOn
		};
	}
	select(fields) {
		return new PgSelectBuilder({
			fields: fields ?? void 0,
			session: void 0,
			dialect: this.getDialect()
		});
	}
	selectDistinct(fields) {
		return new PgSelectBuilder({
			fields: fields ?? void 0,
			session: void 0,
			dialect: this.getDialect(),
			distinct: true
		});
	}
	selectDistinctOn(on, fields) {
		return new PgSelectBuilder({
			fields: fields ?? void 0,
			session: void 0,
			dialect: this.getDialect(),
			distinct: { on }
		});
	}
	getDialect() {
		if (!this.dialect) this.dialect = new PgDialect(this.dialectConfig);
		return this.dialect;
	}
};

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/pg-core/utils.js
function extractUsedTable(table) {
	if (is(table, PgTable)) return [table[Schema] ? `${table[Schema]}.${table[Table.Symbol.BaseName]}` : table[Table.Symbol.BaseName]];
	if (is(table, Subquery)) return table._.usedTables ?? [];
	if (is(table, SQL)) return table.usedTables ?? [];
	return [];
}

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/pg-core/query-builders/delete.js
var PgDeleteBase = class extends QueryPromise {
	constructor(table, session$1, dialect, withList) {
		super();
		this.session = session$1;
		this.dialect = dialect;
		this.config = {
			table,
			withList
		};
	}
	static [entityKind] = "PgDelete";
	config;
	cacheConfig;
	/**
	* Adds a `where` clause to the query.
	*
	* Calling this method will delete only those rows that fulfill a specified condition.
	*
	* See docs: {@link https://orm.drizzle.team/docs/delete}
	*
	* @param where the `where` clause.
	*
	* @example
	* You can use conditional operators and `sql function` to filter the rows to be deleted.
	*
	* ```ts
	* // Delete all cars with green color
	* await db.delete(cars).where(eq(cars.color, 'green'));
	* // or
	* await db.delete(cars).where(sql`${cars.color} = 'green'`)
	* ```
	*
	* You can logically combine conditional operators with `and()` and `or()` operators:
	*
	* ```ts
	* // Delete all BMW cars with a green color
	* await db.delete(cars).where(and(eq(cars.color, 'green'), eq(cars.brand, 'BMW')));
	*
	* // Delete all cars with the green or blue color
	* await db.delete(cars).where(or(eq(cars.color, 'green'), eq(cars.color, 'blue')));
	* ```
	*/
	where(where) {
		this.config.where = where;
		return this;
	}
	returning(fields = this.config.table[Table.Symbol.Columns]) {
		this.config.returningFields = fields;
		this.config.returning = orderSelectedFields(fields);
		return this;
	}
	/** @internal */
	getSQL() {
		return this.dialect.buildDeleteQuery(this.config);
	}
	toSQL() {
		const { typings: _typings, ...rest } = this.dialect.sqlToQuery(this.getSQL());
		return rest;
	}
	/** @internal */
	_prepare(name) {
		return tracer.startActiveSpan("drizzle.prepareQuery", () => {
			return this.session.prepareQuery(this.dialect.sqlToQuery(this.getSQL()), this.config.returning, name, true, void 0, {
				type: "delete",
				tables: extractUsedTable(this.config.table)
			}, this.cacheConfig);
		});
	}
	prepare(name) {
		return this._prepare(name);
	}
	authToken;
	/** @internal */
	setToken(token) {
		this.authToken = token;
		return this;
	}
	execute = (placeholderValues) => {
		return tracer.startActiveSpan("drizzle.operation", () => {
			return this._prepare().execute(placeholderValues, this.authToken);
		});
	};
	/** @internal */
	getSelectedFields() {
		return this.config.returningFields ? new Proxy(this.config.returningFields, new SelectionProxyHandler({
			alias: getTableName(this.config.table),
			sqlAliasedBehavior: "alias",
			sqlBehavior: "error"
		})) : void 0;
	}
	$dynamic() {
		return this;
	}
};

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/pg-core/query-builders/insert.js
var PgInsertBuilder = class {
	constructor(table, session$1, dialect, withList, overridingSystemValue_) {
		this.table = table;
		this.session = session$1;
		this.dialect = dialect;
		this.withList = withList;
		this.overridingSystemValue_ = overridingSystemValue_;
	}
	static [entityKind] = "PgInsertBuilder";
	authToken;
	/** @internal */
	setToken(token) {
		this.authToken = token;
		return this;
	}
	overridingSystemValue() {
		this.overridingSystemValue_ = true;
		return this;
	}
	values(values) {
		values = Array.isArray(values) ? values : [values];
		if (values.length === 0) throw new Error("values() must be called with at least one value");
		const mappedValues = values.map((entry) => {
			const result = {};
			const cols = this.table[Table.Symbol.Columns];
			for (const colKey of Object.keys(entry)) {
				const colValue = entry[colKey];
				result[colKey] = is(colValue, SQL) ? colValue : new Param(colValue, cols[colKey]);
			}
			return result;
		});
		return new PgInsertBase(this.table, mappedValues, this.session, this.dialect, this.withList, false, this.overridingSystemValue_).setToken(this.authToken);
	}
	select(selectQuery) {
		const select = typeof selectQuery === "function" ? selectQuery(new QueryBuilder()) : selectQuery;
		if (!is(select, SQL) && !haveSameKeys(this.table[Columns], select._.selectedFields)) throw new Error("Insert select error: selected fields are not the same or are in a different order compared to the table definition");
		return new PgInsertBase(this.table, select, this.session, this.dialect, this.withList, true);
	}
};
var PgInsertBase = class extends QueryPromise {
	constructor(table, values, session$1, dialect, withList, select, overridingSystemValue_) {
		super();
		this.session = session$1;
		this.dialect = dialect;
		this.config = {
			table,
			values,
			withList,
			select,
			overridingSystemValue_
		};
	}
	static [entityKind] = "PgInsert";
	config;
	cacheConfig;
	returning(fields = this.config.table[Table.Symbol.Columns]) {
		this.config.returningFields = fields;
		this.config.returning = orderSelectedFields(fields);
		return this;
	}
	/**
	* Adds an `on conflict do nothing` clause to the query.
	*
	* Calling this method simply avoids inserting a row as its alternative action.
	*
	* See docs: {@link https://orm.drizzle.team/docs/insert#on-conflict-do-nothing}
	*
	* @param config The `target` and `where` clauses.
	*
	* @example
	* ```ts
	* // Insert one row and cancel the insert if there's a conflict
	* await db.insert(cars)
	*   .values({ id: 1, brand: 'BMW' })
	*   .onConflictDoNothing();
	*
	* // Explicitly specify conflict target
	* await db.insert(cars)
	*   .values({ id: 1, brand: 'BMW' })
	*   .onConflictDoNothing({ target: cars.id });
	* ```
	*/
	onConflictDoNothing(config = {}) {
		if (config.target === void 0) this.config.onConflict = sql`do nothing`;
		else {
			let targetColumn = "";
			targetColumn = Array.isArray(config.target) ? config.target.map((it) => this.dialect.escapeName(this.dialect.casing.getColumnCasing(it))).join(",") : this.dialect.escapeName(this.dialect.casing.getColumnCasing(config.target));
			const whereSql = config.where ? sql` where ${config.where}` : void 0;
			this.config.onConflict = sql`(${sql.raw(targetColumn)})${whereSql} do nothing`;
		}
		return this;
	}
	/**
	* Adds an `on conflict do update` clause to the query.
	*
	* Calling this method will update the existing row that conflicts with the row proposed for insertion as its alternative action.
	*
	* See docs: {@link https://orm.drizzle.team/docs/insert#upserts-and-conflicts}
	*
	* @param config The `target`, `set` and `where` clauses.
	*
	* @example
	* ```ts
	* // Update the row if there's a conflict
	* await db.insert(cars)
	*   .values({ id: 1, brand: 'BMW' })
	*   .onConflictDoUpdate({
	*     target: cars.id,
	*     set: { brand: 'Porsche' }
	*   });
	*
	* // Upsert with 'where' clause
	* await db.insert(cars)
	*   .values({ id: 1, brand: 'BMW' })
	*   .onConflictDoUpdate({
	*     target: cars.id,
	*     set: { brand: 'newBMW' },
	*     targetWhere: sql`${cars.createdAt} > '2023-01-01'::date`,
	*   });
	* ```
	*/
	onConflictDoUpdate(config) {
		if (config.where && (config.targetWhere || config.setWhere)) throw new Error("You cannot use both \"where\" and \"targetWhere\"/\"setWhere\" at the same time - \"where\" is deprecated, use \"targetWhere\" or \"setWhere\" instead.");
		const whereSql = config.where ? sql` where ${config.where}` : void 0;
		const targetWhereSql = config.targetWhere ? sql` where ${config.targetWhere}` : void 0;
		const setWhereSql = config.setWhere ? sql` where ${config.setWhere}` : void 0;
		const setSql = this.dialect.buildUpdateSet(this.config.table, mapUpdateSet(this.config.table, config.set));
		let targetColumn = "";
		targetColumn = Array.isArray(config.target) ? config.target.map((it) => this.dialect.escapeName(this.dialect.casing.getColumnCasing(it))).join(",") : this.dialect.escapeName(this.dialect.casing.getColumnCasing(config.target));
		this.config.onConflict = sql`(${sql.raw(targetColumn)})${targetWhereSql} do update set ${setSql}${whereSql}${setWhereSql}`;
		return this;
	}
	/** @internal */
	getSQL() {
		return this.dialect.buildInsertQuery(this.config);
	}
	toSQL() {
		const { typings: _typings, ...rest } = this.dialect.sqlToQuery(this.getSQL());
		return rest;
	}
	/** @internal */
	_prepare(name) {
		return tracer.startActiveSpan("drizzle.prepareQuery", () => {
			return this.session.prepareQuery(this.dialect.sqlToQuery(this.getSQL()), this.config.returning, name, true, void 0, {
				type: "insert",
				tables: extractUsedTable(this.config.table)
			}, this.cacheConfig);
		});
	}
	prepare(name) {
		return this._prepare(name);
	}
	authToken;
	/** @internal */
	setToken(token) {
		this.authToken = token;
		return this;
	}
	execute = (placeholderValues) => {
		return tracer.startActiveSpan("drizzle.operation", () => {
			return this._prepare().execute(placeholderValues, this.authToken);
		});
	};
	/** @internal */
	getSelectedFields() {
		return this.config.returningFields ? new Proxy(this.config.returningFields, new SelectionProxyHandler({
			alias: getTableName(this.config.table),
			sqlAliasedBehavior: "alias",
			sqlBehavior: "error"
		})) : void 0;
	}
	$dynamic() {
		return this;
	}
};

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/pg-core/query-builders/refresh-materialized-view.js
var PgRefreshMaterializedView = class extends QueryPromise {
	constructor(view, session$1, dialect) {
		super();
		this.session = session$1;
		this.dialect = dialect;
		this.config = { view };
	}
	static [entityKind] = "PgRefreshMaterializedView";
	config;
	concurrently() {
		if (this.config.withNoData !== void 0) throw new Error("Cannot use concurrently and withNoData together");
		this.config.concurrently = true;
		return this;
	}
	withNoData() {
		if (this.config.concurrently !== void 0) throw new Error("Cannot use concurrently and withNoData together");
		this.config.withNoData = true;
		return this;
	}
	/** @internal */
	getSQL() {
		return this.dialect.buildRefreshMaterializedViewQuery(this.config);
	}
	toSQL() {
		const { typings: _typings, ...rest } = this.dialect.sqlToQuery(this.getSQL());
		return rest;
	}
	/** @internal */
	_prepare(name) {
		return tracer.startActiveSpan("drizzle.prepareQuery", () => {
			return this.session.prepareQuery(this.dialect.sqlToQuery(this.getSQL()), void 0, name, true);
		});
	}
	prepare(name) {
		return this._prepare(name);
	}
	authToken;
	/** @internal */
	setToken(token) {
		this.authToken = token;
		return this;
	}
	execute = (placeholderValues) => {
		return tracer.startActiveSpan("drizzle.operation", () => {
			return this._prepare().execute(placeholderValues, this.authToken);
		});
	};
};

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/pg-core/query-builders/update.js
var PgUpdateBuilder = class {
	constructor(table, session$1, dialect, withList) {
		this.table = table;
		this.session = session$1;
		this.dialect = dialect;
		this.withList = withList;
	}
	static [entityKind] = "PgUpdateBuilder";
	authToken;
	setToken(token) {
		this.authToken = token;
		return this;
	}
	set(values) {
		return new PgUpdateBase(this.table, mapUpdateSet(this.table, values), this.session, this.dialect, this.withList).setToken(this.authToken);
	}
};
var PgUpdateBase = class extends QueryPromise {
	constructor(table, set, session$1, dialect, withList) {
		super();
		this.session = session$1;
		this.dialect = dialect;
		this.config = {
			set,
			table,
			withList,
			joins: []
		};
		this.tableName = getTableLikeName(table);
		this.joinsNotNullableMap = typeof this.tableName === "string" ? { [this.tableName]: true } : {};
	}
	static [entityKind] = "PgUpdate";
	config;
	tableName;
	joinsNotNullableMap;
	cacheConfig;
	from(source) {
		const src = source;
		const tableName = getTableLikeName(src);
		if (typeof tableName === "string") this.joinsNotNullableMap[tableName] = true;
		this.config.from = src;
		return this;
	}
	getTableLikeFields(table) {
		if (is(table, PgTable)) return table[Table.Symbol.Columns];
		else if (is(table, Subquery)) return table._.selectedFields;
		return table[ViewBaseConfig].selectedFields;
	}
	createJoin(joinType) {
		return (table, on) => {
			const tableName = getTableLikeName(table);
			if (typeof tableName === "string" && this.config.joins.some((join) => join.alias === tableName)) throw new Error(`Alias "${tableName}" is already used in this query`);
			if (typeof on === "function") {
				const from = this.config.from && !is(this.config.from, SQL) ? this.getTableLikeFields(this.config.from) : void 0;
				on = on(new Proxy(this.config.table[Table.Symbol.Columns], new SelectionProxyHandler({
					sqlAliasedBehavior: "sql",
					sqlBehavior: "sql"
				})), from && new Proxy(from, new SelectionProxyHandler({
					sqlAliasedBehavior: "sql",
					sqlBehavior: "sql"
				})));
			}
			this.config.joins.push({
				on,
				table,
				joinType,
				alias: tableName
			});
			if (typeof tableName === "string") switch (joinType) {
				case "left":
					this.joinsNotNullableMap[tableName] = false;
					break;
				case "right":
					this.joinsNotNullableMap = Object.fromEntries(Object.entries(this.joinsNotNullableMap).map(([key]) => [key, false]));
					this.joinsNotNullableMap[tableName] = true;
					break;
				case "inner":
					this.joinsNotNullableMap[tableName] = true;
					break;
				case "full":
					this.joinsNotNullableMap = Object.fromEntries(Object.entries(this.joinsNotNullableMap).map(([key]) => [key, false]));
					this.joinsNotNullableMap[tableName] = false;
					break;
			}
			return this;
		};
	}
	leftJoin = this.createJoin("left");
	rightJoin = this.createJoin("right");
	innerJoin = this.createJoin("inner");
	fullJoin = this.createJoin("full");
	/**
	* Adds a 'where' clause to the query.
	*
	* Calling this method will update only those rows that fulfill a specified condition.
	*
	* See docs: {@link https://orm.drizzle.team/docs/update}
	*
	* @param where the 'where' clause.
	*
	* @example
	* You can use conditional operators and `sql function` to filter the rows to be updated.
	*
	* ```ts
	* // Update all cars with green color
	* await db.update(cars).set({ color: 'red' })
	*   .where(eq(cars.color, 'green'));
	* // or
	* await db.update(cars).set({ color: 'red' })
	*   .where(sql`${cars.color} = 'green'`)
	* ```
	*
	* You can logically combine conditional operators with `and()` and `or()` operators:
	*
	* ```ts
	* // Update all BMW cars with a green color
	* await db.update(cars).set({ color: 'red' })
	*   .where(and(eq(cars.color, 'green'), eq(cars.brand, 'BMW')));
	*
	* // Update all cars with the green or blue color
	* await db.update(cars).set({ color: 'red' })
	*   .where(or(eq(cars.color, 'green'), eq(cars.color, 'blue')));
	* ```
	*/
	where(where) {
		this.config.where = where;
		return this;
	}
	returning(fields) {
		if (!fields) {
			fields = Object.assign({}, this.config.table[Table.Symbol.Columns]);
			if (this.config.from) {
				const tableName = getTableLikeName(this.config.from);
				if (typeof tableName === "string" && this.config.from && !is(this.config.from, SQL)) fields[tableName] = this.getTableLikeFields(this.config.from);
				for (const join of this.config.joins) {
					const tableName2 = getTableLikeName(join.table);
					if (typeof tableName2 === "string" && !is(join.table, SQL)) fields[tableName2] = this.getTableLikeFields(join.table);
				}
			}
		}
		this.config.returningFields = fields;
		this.config.returning = orderSelectedFields(fields);
		return this;
	}
	/** @internal */
	getSQL() {
		return this.dialect.buildUpdateQuery(this.config);
	}
	toSQL() {
		const { typings: _typings, ...rest } = this.dialect.sqlToQuery(this.getSQL());
		return rest;
	}
	/** @internal */
	_prepare(name) {
		const query$1 = this.session.prepareQuery(this.dialect.sqlToQuery(this.getSQL()), this.config.returning, name, true, void 0, {
			type: "insert",
			tables: extractUsedTable(this.config.table)
		}, this.cacheConfig);
		query$1.joinsNotNullableMap = this.joinsNotNullableMap;
		return query$1;
	}
	prepare(name) {
		return this._prepare(name);
	}
	authToken;
	/** @internal */
	setToken(token) {
		this.authToken = token;
		return this;
	}
	execute = (placeholderValues) => {
		return this._prepare().execute(placeholderValues, this.authToken);
	};
	/** @internal */
	getSelectedFields() {
		return this.config.returningFields ? new Proxy(this.config.returningFields, new SelectionProxyHandler({
			alias: getTableName(this.config.table),
			sqlAliasedBehavior: "alias",
			sqlBehavior: "error"
		})) : void 0;
	}
	$dynamic() {
		return this;
	}
};

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/pg-core/query-builders/count.js
var PgCountBuilder = class PgCountBuilder extends SQL {
	constructor(params) {
		super(PgCountBuilder.buildEmbeddedCount(params.source, params.filters).queryChunks);
		this.params = params;
		this.mapWith(Number);
		this.session = params.session;
		this.sql = PgCountBuilder.buildCount(params.source, params.filters);
	}
	sql;
	token;
	static [entityKind] = "PgCountBuilder";
	[Symbol.toStringTag] = "PgCountBuilder";
	session;
	static buildEmbeddedCount(source, filters) {
		return sql`(select count(*) from ${source}${sql.raw(" where ").if(filters)}${filters})`;
	}
	static buildCount(source, filters) {
		return sql`select count(*) as count from ${source}${sql.raw(" where ").if(filters)}${filters};`;
	}
	/** @intrnal */
	setToken(token) {
		this.token = token;
		return this;
	}
	then(onfulfilled, onrejected) {
		return Promise.resolve(this.session.count(this.sql, this.token)).then(onfulfilled, onrejected);
	}
	catch(onRejected) {
		return this.then(void 0, onRejected);
	}
	finally(onFinally) {
		return this.then((value) => {
			onFinally?.();
			return value;
		}, (reason) => {
			onFinally?.();
			throw reason;
		});
	}
};

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/pg-core/query-builders/query.js
var RelationalQueryBuilder = class {
	constructor(fullSchema, schema, tableNamesMap, table, tableConfig, dialect, session$1) {
		this.fullSchema = fullSchema;
		this.schema = schema;
		this.tableNamesMap = tableNamesMap;
		this.table = table;
		this.tableConfig = tableConfig;
		this.dialect = dialect;
		this.session = session$1;
	}
	static [entityKind] = "PgRelationalQueryBuilder";
	findMany(config) {
		return new PgRelationalQuery(this.fullSchema, this.schema, this.tableNamesMap, this.table, this.tableConfig, this.dialect, this.session, config ? config : {}, "many");
	}
	findFirst(config) {
		return new PgRelationalQuery(this.fullSchema, this.schema, this.tableNamesMap, this.table, this.tableConfig, this.dialect, this.session, config ? {
			...config,
			limit: 1
		} : { limit: 1 }, "first");
	}
};
var PgRelationalQuery = class extends QueryPromise {
	constructor(fullSchema, schema, tableNamesMap, table, tableConfig, dialect, session$1, config, mode) {
		super();
		this.fullSchema = fullSchema;
		this.schema = schema;
		this.tableNamesMap = tableNamesMap;
		this.table = table;
		this.tableConfig = tableConfig;
		this.dialect = dialect;
		this.session = session$1;
		this.config = config;
		this.mode = mode;
	}
	static [entityKind] = "PgRelationalQuery";
	/** @internal */
	_prepare(name) {
		return tracer.startActiveSpan("drizzle.prepareQuery", () => {
			const { query: query$1, builtQuery } = this._toSQL();
			return this.session.prepareQuery(builtQuery, void 0, name, true, (rawRows, mapColumnValue) => {
				const rows = rawRows.map((row) => mapRelationalRow(this.schema, this.tableConfig, row, query$1.selection, mapColumnValue));
				if (this.mode === "first") return rows[0];
				return rows;
			});
		});
	}
	prepare(name) {
		return this._prepare(name);
	}
	_getQuery() {
		return this.dialect.buildRelationalQueryWithoutPK({
			fullSchema: this.fullSchema,
			schema: this.schema,
			tableNamesMap: this.tableNamesMap,
			table: this.table,
			tableConfig: this.tableConfig,
			queryConfig: this.config,
			tableAlias: this.tableConfig.tsName
		});
	}
	/** @internal */
	getSQL() {
		return this._getQuery().sql;
	}
	_toSQL() {
		const query$1 = this._getQuery();
		return {
			query: query$1,
			builtQuery: this.dialect.sqlToQuery(query$1.sql)
		};
	}
	toSQL() {
		return this._toSQL().builtQuery;
	}
	authToken;
	/** @internal */
	setToken(token) {
		this.authToken = token;
		return this;
	}
	execute() {
		return tracer.startActiveSpan("drizzle.operation", () => {
			return this._prepare().execute(void 0, this.authToken);
		});
	}
};

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/pg-core/query-builders/raw.js
var PgRaw = class extends QueryPromise {
	constructor(execute$1, sql$1, query$1, mapBatchResult) {
		super();
		this.execute = execute$1;
		this.sql = sql$1;
		this.query = query$1;
		this.mapBatchResult = mapBatchResult;
	}
	static [entityKind] = "PgRaw";
	/** @internal */
	getSQL() {
		return this.sql;
	}
	getQuery() {
		return this.query;
	}
	mapResult(result, isFromBatch) {
		return isFromBatch ? this.mapBatchResult(result) : result;
	}
	_prepare() {
		return this;
	}
	/** @internal */
	isResponseInArrayMode() {
		return false;
	}
};

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/pg-core/db.js
var PgDatabase = class {
	constructor(dialect, session$1, schema) {
		this.dialect = dialect;
		this.session = session$1;
		this._ = schema ? {
			schema: schema.schema,
			fullSchema: schema.fullSchema,
			tableNamesMap: schema.tableNamesMap,
			session: session$1
		} : {
			schema: void 0,
			fullSchema: {},
			tableNamesMap: {},
			session: session$1
		};
		this.query = {};
		if (this._.schema) for (const [tableName, columns] of Object.entries(this._.schema)) this.query[tableName] = new RelationalQueryBuilder(schema.fullSchema, this._.schema, this._.tableNamesMap, schema.fullSchema[tableName], columns, dialect, session$1);
		this.$cache = { invalidate: async (_params) => {} };
	}
	static [entityKind] = "PgDatabase";
	query;
	/**
	* Creates a subquery that defines a temporary named result set as a CTE.
	*
	* It is useful for breaking down complex queries into simpler parts and for reusing the result set in subsequent parts of the query.
	*
	* See docs: {@link https://orm.drizzle.team/docs/select#with-clause}
	*
	* @param alias The alias for the subquery.
	*
	* Failure to provide an alias will result in a DrizzleTypeError, preventing the subquery from being referenced in other queries.
	*
	* @example
	*
	* ```ts
	* // Create a subquery with alias 'sq' and use it in the select query
	* const sq = db.$with('sq').as(db.select().from(users).where(eq(users.id, 42)));
	*
	* const result = await db.with(sq).select().from(sq);
	* ```
	*
	* To select arbitrary SQL values as fields in a CTE and reference them in other CTEs or in the main query, you need to add aliases to them:
	*
	* ```ts
	* // Select an arbitrary SQL value as a field in a CTE and reference it in the main query
	* const sq = db.$with('sq').as(db.select({
	*   name: sql<string>`upper(${users.name})`.as('name'),
	* })
	* .from(users));
	*
	* const result = await db.with(sq).select({ name: sq.name }).from(sq);
	* ```
	*/
	$with = (alias, selection) => {
		const self = this;
		const as = (qb) => {
			if (typeof qb === "function") qb = qb(new QueryBuilder(self.dialect));
			return new Proxy(new WithSubquery(qb.getSQL(), selection ?? ("getSelectedFields" in qb ? qb.getSelectedFields() ?? {} : {}), alias, true), new SelectionProxyHandler({
				alias,
				sqlAliasedBehavior: "alias",
				sqlBehavior: "error"
			}));
		};
		return { as };
	};
	$count(source, filters) {
		return new PgCountBuilder({
			source,
			filters,
			session: this.session
		});
	}
	$cache;
	/**
	* Incorporates a previously defined CTE (using `$with`) into the main query.
	*
	* This method allows the main query to reference a temporary named result set.
	*
	* See docs: {@link https://orm.drizzle.team/docs/select#with-clause}
	*
	* @param queries The CTEs to incorporate into the main query.
	*
	* @example
	*
	* ```ts
	* // Define a subquery 'sq' as a CTE using $with
	* const sq = db.$with('sq').as(db.select().from(users).where(eq(users.id, 42)));
	*
	* // Incorporate the CTE 'sq' into the main query and select from it
	* const result = await db.with(sq).select().from(sq);
	* ```
	*/
	with(...queries) {
		const self = this;
		function select(fields) {
			return new PgSelectBuilder({
				fields: fields ?? void 0,
				session: self.session,
				dialect: self.dialect,
				withList: queries
			});
		}
		function selectDistinct(fields) {
			return new PgSelectBuilder({
				fields: fields ?? void 0,
				session: self.session,
				dialect: self.dialect,
				withList: queries,
				distinct: true
			});
		}
		function selectDistinctOn(on, fields) {
			return new PgSelectBuilder({
				fields: fields ?? void 0,
				session: self.session,
				dialect: self.dialect,
				withList: queries,
				distinct: { on }
			});
		}
		function update(table) {
			return new PgUpdateBuilder(table, self.session, self.dialect, queries);
		}
		function insert(table) {
			return new PgInsertBuilder(table, self.session, self.dialect, queries);
		}
		function delete_(table) {
			return new PgDeleteBase(table, self.session, self.dialect, queries);
		}
		return {
			select,
			selectDistinct,
			selectDistinctOn,
			update,
			insert,
			delete: delete_
		};
	}
	select(fields) {
		return new PgSelectBuilder({
			fields: fields ?? void 0,
			session: this.session,
			dialect: this.dialect
		});
	}
	selectDistinct(fields) {
		return new PgSelectBuilder({
			fields: fields ?? void 0,
			session: this.session,
			dialect: this.dialect,
			distinct: true
		});
	}
	selectDistinctOn(on, fields) {
		return new PgSelectBuilder({
			fields: fields ?? void 0,
			session: this.session,
			dialect: this.dialect,
			distinct: { on }
		});
	}
	/**
	* Creates an update query.
	*
	* Calling this method without `.where()` clause will update all rows in a table. The `.where()` clause specifies which rows should be updated.
	*
	* Use `.set()` method to specify which values to update.
	*
	* See docs: {@link https://orm.drizzle.team/docs/update}
	*
	* @param table The table to update.
	*
	* @example
	*
	* ```ts
	* // Update all rows in the 'cars' table
	* await db.update(cars).set({ color: 'red' });
	*
	* // Update rows with filters and conditions
	* await db.update(cars).set({ color: 'red' }).where(eq(cars.brand, 'BMW'));
	*
	* // Update with returning clause
	* const updatedCar: Car[] = await db.update(cars)
	*   .set({ color: 'red' })
	*   .where(eq(cars.id, 1))
	*   .returning();
	* ```
	*/
	update(table) {
		return new PgUpdateBuilder(table, this.session, this.dialect);
	}
	/**
	* Creates an insert query.
	*
	* Calling this method will create new rows in a table. Use `.values()` method to specify which values to insert.
	*
	* See docs: {@link https://orm.drizzle.team/docs/insert}
	*
	* @param table The table to insert into.
	*
	* @example
	*
	* ```ts
	* // Insert one row
	* await db.insert(cars).values({ brand: 'BMW' });
	*
	* // Insert multiple rows
	* await db.insert(cars).values([{ brand: 'BMW' }, { brand: 'Porsche' }]);
	*
	* // Insert with returning clause
	* const insertedCar: Car[] = await db.insert(cars)
	*   .values({ brand: 'BMW' })
	*   .returning();
	* ```
	*/
	insert(table) {
		return new PgInsertBuilder(table, this.session, this.dialect);
	}
	/**
	* Creates a delete query.
	*
	* Calling this method without `.where()` clause will delete all rows in a table. The `.where()` clause specifies which rows should be deleted.
	*
	* See docs: {@link https://orm.drizzle.team/docs/delete}
	*
	* @param table The table to delete from.
	*
	* @example
	*
	* ```ts
	* // Delete all rows in the 'cars' table
	* await db.delete(cars);
	*
	* // Delete rows with filters and conditions
	* await db.delete(cars).where(eq(cars.color, 'green'));
	*
	* // Delete with returning clause
	* const deletedCar: Car[] = await db.delete(cars)
	*   .where(eq(cars.id, 1))
	*   .returning();
	* ```
	*/
	delete(table) {
		return new PgDeleteBase(table, this.session, this.dialect);
	}
	refreshMaterializedView(view) {
		return new PgRefreshMaterializedView(view, this.session, this.dialect);
	}
	authToken;
	execute(query$1) {
		const sequel = typeof query$1 === "string" ? sql.raw(query$1) : query$1.getSQL();
		const builtQuery = this.dialect.sqlToQuery(sequel);
		const prepared = this.session.prepareQuery(builtQuery, void 0, void 0, false);
		return new PgRaw(() => prepared.execute(void 0, this.authToken), sequel, builtQuery, (result) => prepared.mapResult(result, true));
	}
	transaction(transaction, config) {
		return this.session.transaction(transaction, config);
	}
};

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/cache/core/cache.js
var Cache = class {
	static [entityKind] = "Cache";
};
var NoopCache = class extends Cache {
	strategy() {
		return "all";
	}
	static [entityKind] = "NoopCache";
	async get(_key) {}
	async put(_hashedQuery, _response, _tables, _config) {}
	async onMutate(_params) {}
};
async function hashQuery(sql$1, params) {
	const dataToHash = `${sql$1}-${JSON.stringify(params)}`;
	const data = new TextEncoder().encode(dataToHash);
	const hashBuffer = await crypto.subtle.digest("SHA-256", data);
	return [...new Uint8Array(hashBuffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/pg-core/session.js
var PgPreparedQuery = class {
	constructor(query$1, cache, queryMetadata, cacheConfig) {
		this.query = query$1;
		this.cache = cache;
		this.queryMetadata = queryMetadata;
		this.cacheConfig = cacheConfig;
		if (cache && cache.strategy() === "all" && cacheConfig === void 0) this.cacheConfig = {
			enable: true,
			autoInvalidate: true
		};
		if (!this.cacheConfig?.enable) this.cacheConfig = void 0;
	}
	authToken;
	getQuery() {
		return this.query;
	}
	mapResult(response, _isFromBatch) {
		return response;
	}
	/** @internal */
	setToken(token) {
		this.authToken = token;
		return this;
	}
	static [entityKind] = "PgPreparedQuery";
	/** @internal */
	joinsNotNullableMap;
	/** @internal */
	async queryWithCache(queryString, params, query$1) {
		if (this.cache === void 0 || is(this.cache, NoopCache) || this.queryMetadata === void 0) try {
			return await query$1();
		} catch (e) {
			throw new DrizzleQueryError(queryString, params, e);
		}
		if (this.cacheConfig && !this.cacheConfig.enable) try {
			return await query$1();
		} catch (e) {
			throw new DrizzleQueryError(queryString, params, e);
		}
		if ((this.queryMetadata.type === "insert" || this.queryMetadata.type === "update" || this.queryMetadata.type === "delete") && this.queryMetadata.tables.length > 0) try {
			const [res] = await Promise.all([query$1(), this.cache.onMutate({ tables: this.queryMetadata.tables })]);
			return res;
		} catch (e) {
			throw new DrizzleQueryError(queryString, params, e);
		}
		if (!this.cacheConfig) try {
			return await query$1();
		} catch (e) {
			throw new DrizzleQueryError(queryString, params, e);
		}
		if (this.queryMetadata.type === "select") {
			const fromCache = await this.cache.get(this.cacheConfig.tag ?? await hashQuery(queryString, params), this.queryMetadata.tables, this.cacheConfig.tag !== void 0, this.cacheConfig.autoInvalidate);
			if (fromCache === void 0) {
				let result;
				try {
					result = await query$1();
				} catch (e) {
					throw new DrizzleQueryError(queryString, params, e);
				}
				await this.cache.put(this.cacheConfig.tag ?? await hashQuery(queryString, params), result, this.cacheConfig.autoInvalidate ? this.queryMetadata.tables : [], this.cacheConfig.tag !== void 0, this.cacheConfig.config);
				return result;
			}
			return fromCache;
		}
		try {
			return await query$1();
		} catch (e) {
			throw new DrizzleQueryError(queryString, params, e);
		}
	}
};
var PgSession = class {
	constructor(dialect) {
		this.dialect = dialect;
	}
	static [entityKind] = "PgSession";
	/** @internal */
	execute(query$1, token) {
		return tracer.startActiveSpan("drizzle.operation", () => {
			return tracer.startActiveSpan("drizzle.prepareQuery", () => {
				return this.prepareQuery(this.dialect.sqlToQuery(query$1), void 0, void 0, false);
			}).setToken(token).execute(void 0, token);
		});
	}
	all(query$1) {
		return this.prepareQuery(this.dialect.sqlToQuery(query$1), void 0, void 0, false).all();
	}
	/** @internal */
	async count(sql2, token) {
		const res = await this.execute(sql2, token);
		return Number(res[0]["count"]);
	}
};
var PgTransaction = class extends PgDatabase {
	constructor(dialect, session$1, schema, nestedIndex = 0) {
		super(dialect, session$1, schema);
		this.schema = schema;
		this.nestedIndex = nestedIndex;
	}
	static [entityKind] = "PgTransaction";
	rollback() {
		throw new TransactionRollbackError();
	}
	/** @internal */
	getTransactionConfigSQL(config) {
		const chunks = [];
		if (config.isolationLevel) chunks.push(`isolation level ${config.isolationLevel}`);
		if (config.accessMode) chunks.push(config.accessMode);
		if (typeof config.deferrable === "boolean") chunks.push(config.deferrable ? "deferrable" : "not deferrable");
		return sql.raw(chunks.join(" "));
	}
	setTransaction(config) {
		return this.session.execute(sql`set transaction ${this.getTransactionConfigSQL(config)}`);
	}
};

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/node-postgres/session.js
const { Pool, types } = esm_default;
var NodePgPreparedQuery = class extends PgPreparedQuery {
	constructor(client, queryString, params, logger$1, cache, queryMetadata, cacheConfig, fields, name, _isResponseInArrayMode, customResultMapper) {
		super({
			sql: queryString,
			params
		}, cache, queryMetadata, cacheConfig);
		this.client = client;
		this.queryString = queryString;
		this.params = params;
		this.logger = logger$1;
		this.fields = fields;
		this._isResponseInArrayMode = _isResponseInArrayMode;
		this.customResultMapper = customResultMapper;
		this.rawQueryConfig = {
			name,
			text: queryString,
			types: { getTypeParser: (typeId, format) => {
				if (typeId === types.builtins.TIMESTAMPTZ) return (val$1) => val$1;
				if (typeId === types.builtins.TIMESTAMP) return (val$1) => val$1;
				if (typeId === types.builtins.DATE) return (val$1) => val$1;
				if (typeId === types.builtins.INTERVAL) return (val$1) => val$1;
				if (typeId === 1231) return (val$1) => val$1;
				if (typeId === 1115) return (val$1) => val$1;
				if (typeId === 1185) return (val$1) => val$1;
				if (typeId === 1187) return (val$1) => val$1;
				if (typeId === 1182) return (val$1) => val$1;
				return types.getTypeParser(typeId, format);
			} }
		};
		this.queryConfig = {
			name,
			text: queryString,
			rowMode: "array",
			types: { getTypeParser: (typeId, format) => {
				if (typeId === types.builtins.TIMESTAMPTZ) return (val$1) => val$1;
				if (typeId === types.builtins.TIMESTAMP) return (val$1) => val$1;
				if (typeId === types.builtins.DATE) return (val$1) => val$1;
				if (typeId === types.builtins.INTERVAL) return (val$1) => val$1;
				if (typeId === 1231) return (val$1) => val$1;
				if (typeId === 1115) return (val$1) => val$1;
				if (typeId === 1185) return (val$1) => val$1;
				if (typeId === 1187) return (val$1) => val$1;
				if (typeId === 1182) return (val$1) => val$1;
				return types.getTypeParser(typeId, format);
			} }
		};
	}
	static [entityKind] = "NodePgPreparedQuery";
	rawQueryConfig;
	queryConfig;
	async execute(placeholderValues = {}) {
		return tracer.startActiveSpan("drizzle.execute", async () => {
			const params = fillPlaceholders(this.params, placeholderValues);
			this.logger.logQuery(this.rawQueryConfig.text, params);
			const { fields, rawQueryConfig: rawQuery, client, queryConfig: query$1, joinsNotNullableMap, customResultMapper } = this;
			if (!fields && !customResultMapper) return tracer.startActiveSpan("drizzle.driver.execute", async (span) => {
				span?.setAttributes({
					"drizzle.query.name": rawQuery.name,
					"drizzle.query.text": rawQuery.text,
					"drizzle.query.params": JSON.stringify(params)
				});
				return this.queryWithCache(rawQuery.text, params, async () => {
					return await client.query(rawQuery, params);
				});
			});
			const result = await tracer.startActiveSpan("drizzle.driver.execute", (span) => {
				span?.setAttributes({
					"drizzle.query.name": query$1.name,
					"drizzle.query.text": query$1.text,
					"drizzle.query.params": JSON.stringify(params)
				});
				return this.queryWithCache(query$1.text, params, async () => {
					return await client.query(query$1, params);
				});
			});
			return tracer.startActiveSpan("drizzle.mapResponse", () => {
				return customResultMapper ? customResultMapper(result.rows) : result.rows.map((row) => mapResultRow(fields, row, joinsNotNullableMap));
			});
		});
	}
	all(placeholderValues = {}) {
		return tracer.startActiveSpan("drizzle.execute", () => {
			const params = fillPlaceholders(this.params, placeholderValues);
			this.logger.logQuery(this.rawQueryConfig.text, params);
			return tracer.startActiveSpan("drizzle.driver.execute", (span) => {
				span?.setAttributes({
					"drizzle.query.name": this.rawQueryConfig.name,
					"drizzle.query.text": this.rawQueryConfig.text,
					"drizzle.query.params": JSON.stringify(params)
				});
				return this.queryWithCache(this.rawQueryConfig.text, params, async () => {
					return this.client.query(this.rawQueryConfig, params);
				}).then((result) => result.rows);
			});
		});
	}
	/** @internal */
	isResponseInArrayMode() {
		return this._isResponseInArrayMode;
	}
};
var NodePgSession = class NodePgSession extends PgSession {
	constructor(client, dialect, schema, options = {}) {
		super(dialect);
		this.client = client;
		this.schema = schema;
		this.options = options;
		this.logger = options.logger ?? new NoopLogger();
		this.cache = options.cache ?? new NoopCache();
	}
	static [entityKind] = "NodePgSession";
	logger;
	cache;
	prepareQuery(query$1, fields, name, isResponseInArrayMode, customResultMapper, queryMetadata, cacheConfig) {
		return new NodePgPreparedQuery(this.client, query$1.sql, query$1.params, this.logger, this.cache, queryMetadata, cacheConfig, fields, name, isResponseInArrayMode, customResultMapper);
	}
	async transaction(transaction, config) {
		const isPool = this.client instanceof Pool || Object.getPrototypeOf(this.client).constructor.name.includes("Pool");
		const session$1 = isPool ? new NodePgSession(await this.client.connect(), this.dialect, this.schema, this.options) : this;
		const tx = new NodePgTransaction(this.dialect, session$1, this.schema);
		await tx.execute(sql`begin${config ? sql` ${tx.getTransactionConfigSQL(config)}` : void 0}`);
		try {
			const result = await transaction(tx);
			await tx.execute(sql`commit`);
			return result;
		} catch (error) {
			await tx.execute(sql`rollback`);
			throw error;
		} finally {
			if (isPool) session$1.client.release();
		}
	}
	async count(sql2) {
		const res = await this.execute(sql2);
		return Number(res["rows"][0]["count"]);
	}
};
var NodePgTransaction = class NodePgTransaction extends PgTransaction {
	static [entityKind] = "NodePgTransaction";
	async transaction(transaction) {
		const savepointName = `sp${this.nestedIndex + 1}`;
		const tx = new NodePgTransaction(this.dialect, this.session, this.schema, this.nestedIndex + 1);
		await tx.execute(sql.raw(`savepoint ${savepointName}`));
		try {
			const result = await transaction(tx);
			await tx.execute(sql.raw(`release savepoint ${savepointName}`));
			return result;
		} catch (err) {
			await tx.execute(sql.raw(`rollback to savepoint ${savepointName}`));
			throw err;
		}
	}
};

//#endregion
//#region ../../node_modules/.bun/drizzle-orm@0.45.2+fd94c996d3bcf6f4/node_modules/drizzle-orm/node-postgres/driver.js
var NodePgDriver = class {
	constructor(client, dialect, options = {}) {
		this.client = client;
		this.dialect = dialect;
		this.options = options;
	}
	static [entityKind] = "NodePgDriver";
	createSession(schema) {
		return new NodePgSession(this.client, this.dialect, schema, {
			logger: this.options.logger,
			cache: this.options.cache
		});
	}
};
var NodePgDatabase = class extends PgDatabase {
	static [entityKind] = "NodePgDatabase";
};
function construct(client, config = {}) {
	const dialect = new PgDialect({ casing: config.casing });
	let logger$1;
	if (config.logger === true) logger$1 = new DefaultLogger();
	else if (config.logger !== false) logger$1 = config.logger;
	let schema;
	if (config.schema) {
		const tablesConfig = extractTablesRelationalConfig(config.schema, createTableRelationsHelpers);
		schema = {
			fullSchema: config.schema,
			schema: tablesConfig.tables,
			tableNamesMap: tablesConfig.tableNamesMap
		};
	}
	const db$1 = new NodePgDatabase(dialect, new NodePgDriver(client, dialect, {
		logger: logger$1,
		cache: config.cache
	}).createSession(schema), schema);
	db$1.$client = client;
	db$1.$cache = config.cache;
	if (db$1.$cache) db$1.$cache["invalidate"] = config.cache?.onMutate;
	return db$1;
}
function drizzle(...params) {
	if (typeof params[0] === "string") return construct(new esm_default.Pool({ connectionString: params[0] }), params[1]);
	if (isConfig(params[0])) {
		const { connection, client, ...drizzleConfig } = params[0];
		if (client) return construct(client, drizzleConfig);
		return construct(typeof connection === "string" ? new esm_default.Pool({ connectionString: connection }) : new esm_default.Pool(connection), drizzleConfig);
	}
	return construct(params[0], params[1]);
}
((drizzle2) => {
	function mock(config) {
		return construct({}, config);
	}
	drizzle2.mock = mock;
})(drizzle || (drizzle = {}));

//#endregion
//#region ../../packages/db/src/schema/auth.ts
var auth_exports = /* @__PURE__ */ __export({
	account: () => account,
	accountRelations: () => accountRelations,
	session: () => session,
	sessionRelations: () => sessionRelations,
	user: () => user,
	userRelations: () => userRelations,
	verification: () => verification
});
const user = pgTable("user", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	emailVerified: boolean("email_verified").default(false).notNull(),
	image: text("image"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => /* @__PURE__ */ new Date()).notNull()
});
const session = pgTable("session", {
	id: text("id").primaryKey(),
	expiresAt: timestamp("expires_at").notNull(),
	token: text("token").notNull().unique(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").$onUpdate(() => /* @__PURE__ */ new Date()).notNull(),
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
	userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" })
}, (table) => [index("session_userId_idx").on(table.userId)]);
const account = pgTable("account", {
	id: text("id").primaryKey(),
	accountId: text("account_id").notNull(),
	providerId: text("provider_id").notNull(),
	userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
	accessToken: text("access_token"),
	refreshToken: text("refresh_token"),
	idToken: text("id_token"),
	accessTokenExpiresAt: timestamp("access_token_expires_at"),
	refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
	scope: text("scope"),
	password: text("password"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").$onUpdate(() => /* @__PURE__ */ new Date()).notNull()
}, (table) => [index("account_userId_idx").on(table.userId)]);
const verification = pgTable("verification", {
	id: text("id").primaryKey(),
	identifier: text("identifier").notNull(),
	value: text("value").notNull(),
	expiresAt: timestamp("expires_at").notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => /* @__PURE__ */ new Date()).notNull()
}, (table) => [index("verification_identifier_idx").on(table.identifier)]);
const userRelations = relations(user, ({ many }) => ({
	sessions: many(session),
	accounts: many(account)
}));
const sessionRelations = relations(session, ({ one }) => ({ user: one(user, {
	fields: [session.userId],
	references: [user.id]
}) }));
const accountRelations = relations(account, ({ one }) => ({ user: one(user, {
	fields: [account.userId],
	references: [user.id]
}) }));

//#endregion
//#region ../../packages/db/src/schema/portfolio.ts
const pageViews = pgTable("page_views", {
	id: serial("id").primaryKey(),
	slug: text("slug").notNull().unique(),
	count: integer("count").default(0).notNull(),
	updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => /* @__PURE__ */ new Date()).notNull()
});
const guestbookEntries = pgTable("guestbook_entries", {
	id: serial("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull(),
	message: text("message").notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull()
});
/**
* One signature per user, enforced at the DB layer via `.unique()` on
* `userId`. A second insert for the same user throws a unique-constraint
* violation which the router catches and turns into a friendly error.
*/
const guestbookSignatures = pgTable("guestbook_signatures", {
	id: serial("id").primaryKey(),
	userId: text("user_id").notNull().unique().references(() => user.id, { onDelete: "cascade" }),
	svgPath: text("svg_path").notNull(),
	width: integer("width").notNull(),
	height: integer("height").notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull()
});

//#endregion
//#region ../../packages/db/src/schema/index.ts
var schema_exports = /* @__PURE__ */ __export({
	account: () => account,
	accountRelations: () => accountRelations,
	guestbookEntries: () => guestbookEntries,
	guestbookSignatures: () => guestbookSignatures,
	pageViews: () => pageViews,
	session: () => session,
	sessionRelations: () => sessionRelations,
	user: () => user,
	userRelations: () => userRelations,
	verification: () => verification
});

//#endregion
//#region ../../packages/db/src/index.ts
function createDb() {
	return drizzle(env.DATABASE_URL, { schema: schema_exports });
}
const db = createDb();

//#endregion
//#region ../../packages/auth/src/index.ts
function createAuth() {
	return betterAuth({
		database: drizzleAdapter(createDb(), {
			provider: "pg",
			schema: auth_exports
		}),
		trustedOrigins: env.CORS_ORIGIN,
		emailAndPassword: { enabled: false },
		socialProviders: { google: {
			clientId: env.GOOGLE_CLIENT_ID,
			clientSecret: env.GOOGLE_CLIENT_SECRET
		} },
		secret: env.BETTER_AUTH_SECRET,
		baseURL: env.BETTER_AUTH_URL,
		advanced: { defaultCookieAttributes: {
			sameSite: "none",
			secure: true,
			httpOnly: true
		} },
		plugins: []
	});
}
const auth = createAuth();

//#endregion
//#region ../../packages/api/src/context.ts
async function createContext({ context }) {
	return {
		auth: null,
		session: await auth.api.getSession({ headers: context.req.raw.headers })
	};
}

//#endregion
//#region ../../packages/api/src/index.ts
const o = os.$context();
const publicProcedure = o;
const requireAuth = o.middleware(async ({ context, next }) => {
	if (!context.session?.user) throw new ORPCError("UNAUTHORIZED");
	return next({ context: { session: context.session } });
});
const protectedProcedure = publicProcedure.use(requireAuth);

//#endregion
//#region ../../packages/api/src/routers/index.ts
let spotifyAccessToken = null;
let spotifyTokenExpiry = 0;
async function getSpotifyAccessToken() {
	const clientId = process.env.SPOTIFY_CLIENT_ID;
	const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
	const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;
	if (!clientId || !clientSecret || !refreshToken) return null;
	if (spotifyAccessToken && Date.now() < spotifyTokenExpiry) return spotifyAccessToken;
	const data = await (await fetch("https://accounts.spotify.com/api/token", {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
			Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`
		},
		body: new URLSearchParams({
			grant_type: "refresh_token",
			refresh_token: refreshToken
		})
	})).json();
	if (data.access_token && typeof data.expires_in === "number") {
		spotifyAccessToken = data.access_token;
		spotifyTokenExpiry = Date.now() + (data.expires_in - 60) * 1e3;
		return spotifyAccessToken;
	}
	return null;
}
const appRouter = {
	healthCheck: publicProcedure.handler(() => {
		return "OK";
	}),
	nowPlaying: publicProcedure.handler(async () => {
		const token = await getSpotifyAccessToken();
		if (!token) return { isPlaying: false };
		const response = await fetch("https://api.spotify.com/v1/me/player/currently-playing", { headers: { Authorization: `Bearer ${token}` } });
		if (response.status === 204 || response.status > 400) {
			const recentRes = await fetch("https://api.spotify.com/v1/me/player/recently-played?limit=1", { headers: { Authorization: `Bearer ${token}` } });
			if (!recentRes.ok) return { isPlaying: false };
			const track = (await recentRes.json()).items?.[0]?.track;
			if (!track) return { isPlaying: false };
			return {
				isPlaying: false,
				title: track.name,
				artist: track.artists.map((a) => a.name).join(", "),
				albumArt: track.album?.images?.[2]?.url || track.album?.images?.[0]?.url,
				songUrl: track.external_urls?.spotify
			};
		}
		const data = await response.json();
		if (!data.item) return { isPlaying: false };
		return {
			isPlaying: data.is_playing,
			title: data.item.name,
			artist: data.item.artists.map((a) => a.name).join(", "),
			albumArt: data.item.album?.images?.[2]?.url || data.item.album?.images?.[0]?.url,
			songUrl: data.item.external_urls?.spotify
		};
	}),
	pageView: publicProcedure.handler(async () => {
		return { views: (await db.insert(pageViews).values({
			slug: "home",
			count: 1
		}).onConflictDoUpdate({
			target: pageViews.slug,
			set: { count: sql`${pageViews.count} + 1` }
		}).returning({ count: pageViews.count }))[0]?.count ?? 0 };
	}),
	getPageViews: publicProcedure.handler(async () => {
		return { views: (await db.select({ count: pageViews.count }).from(pageViews).where(eq(pageViews.slug, "home")).limit(1))[0]?.count ?? 0 };
	}),
	listGuestbook: publicProcedure.handler(async () => {
		return await db.select({
			id: guestbookEntries.id,
			name: guestbookEntries.name,
			message: guestbookEntries.message,
			createdAt: guestbookEntries.createdAt
		}).from(guestbookEntries).orderBy(desc(guestbookEntries.createdAt)).limit(50);
	}),
	signGuestbook: protectedProcedure.input(z.object({ message: z.string().min(1, "Message cannot be empty").max(280, "Message too long (max 280 chars)") })).handler(async ({ context, input }) => {
		const user$2 = context.session.user;
		return (await db.insert(guestbookEntries).values({
			name: user$2.name || "Anonymous",
			email: user$2.email,
			message: input.message.trim()
		}).returning())[0];
	}),
	weather: publicProcedure.handler(async () => {
		const cached = weatherCache;
		if (cached && Date.now() - cached.at < 10 * 6e4) return cached.value;
		try {
			const res = await fetch("https://api.open-meteo.com/v1/forecast?latitude=12.9716&longitude=77.5946&current=temperature_2m,weather_code,is_day", { signal: AbortSignal.timeout(6e3) });
			if (!res.ok) throw new Error(`status ${res.status}`);
			const data = await res.json();
			const value = {
				temperatureC: data.current?.temperature_2m ?? null,
				weatherCode: data.current?.weather_code ?? null,
				isDay: data.current?.is_day === 1
			};
			weatherCache = {
				value,
				at: Date.now()
			};
			return value;
		} catch {
			return {
				temperatureC: null,
				weatherCode: null,
				isDay: null
			};
		}
	}),
	getGuestbookState: publicProcedure.handler(async ({ context }) => {
		const userId = context.session?.user?.id ?? null;
		const [countRow] = await db.select({ count: sql`count(*)::int` }).from(guestbookSignatures);
		const recent = await db.select({
			id: guestbookSignatures.id,
			svgPath: guestbookSignatures.svgPath,
			width: guestbookSignatures.width,
			height: guestbookSignatures.height,
			createdAt: guestbookSignatures.createdAt
		}).from(guestbookSignatures).orderBy(desc(guestbookSignatures.createdAt)).limit(40);
		let userSignature = null;
		if (userId) {
			const [own] = await db.select({
				id: guestbookSignatures.id,
				svgPath: guestbookSignatures.svgPath,
				width: guestbookSignatures.width,
				height: guestbookSignatures.height,
				createdAt: guestbookSignatures.createdAt
			}).from(guestbookSignatures).where(eq(guestbookSignatures.userId, userId)).limit(1);
			userSignature = own ?? null;
		}
		return {
			totalCount: countRow?.count ?? 0,
			userHasSigned: userId ? userSignature !== null : null,
			userSignature,
			recent
		};
	}),
	signGuestbookHandwriting: protectedProcedure.input(z.object({
		svgPath: z.string().min(20, "Signature too short").max(48e3, "Signature too long"),
		width: z.number().int().positive().max(2e3),
		height: z.number().int().positive().max(800)
	})).handler(async ({ context, input }) => {
		if (!/^[MLQZ\d\s.,\-]+$/.test(input.svgPath)) throw new Error("Invalid signature path");
		const userId = context.session.user.id;
		try {
			return (await db.insert(guestbookSignatures).values({
				userId,
				svgPath: input.svgPath,
				width: input.width,
				height: input.height
			}).returning())[0];
		} catch (err) {
			if (err?.code === "23505") throw new Error("You've already signed the guestbook");
			throw err;
		}
	})
};
let weatherCache = null;

//#endregion
//#region src/index.ts
const app = new Hono();
const allowedOrigins = new Set(env.CORS_ORIGIN);
app.use(logger());
app.use("/*", cors({
	origin: (origin) => origin && allowedOrigins.has(origin) ? origin : null,
	allowMethods: [
		"GET",
		"POST",
		"OPTIONS"
	],
	allowHeaders: ["Content-Type", "Authorization"],
	credentials: true
}));
app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));
const apiHandler = new OpenAPIHandler(appRouter, {
	plugins: [new OpenAPIReferencePlugin({ schemaConverters: [new ZodToJsonSchemaConverter()] })],
	interceptors: [onError((error) => {
		console.error(error);
	})]
});
const rpcHandler = new RPCHandler(appRouter, { interceptors: [onError((error) => {
	console.error(error);
})] });
app.use("/*", async (c, next) => {
	const context = await createContext({ context: c });
	const rpcResult = await rpcHandler.handle(c.req.raw, {
		prefix: "/rpc",
		context
	});
	if (rpcResult.matched) return c.newResponse(rpcResult.response.body, rpcResult.response);
	const apiResult = await apiHandler.handle(c.req.raw, {
		prefix: "/api-reference",
		context
	});
	if (apiResult.matched) return c.newResponse(apiResult.response.body, apiResult.response);
	await next();
});
app.get("/", (c) => {
	return c.json({
		ok: true,
		path: c.req.path,
		url: c.req.url,
		method: c.req.method,
		marker: "diag-9f8a"
	});
});
var src_default = app;

//#endregion
//#region src/handler.ts
const honoFetch = handle(src_default);
var handler_default = { async fetch(req) {
	try {
		const url = new URL(req.url);
		if (url.pathname === "/") return Response.json({
			marker: "handler-bypass",
			url: req.url,
			pathname: url.pathname,
			method: req.method
		});
		return await honoFetch(req);
	} catch (err) {
		const e = err;
		return new Response(`HANDLER ERROR: ${e.message}\n\n${e.stack}`, {
			status: 500,
			headers: { "content-type": "text/plain" }
		});
	}
} };

//#endregion
export { handler_default as default };