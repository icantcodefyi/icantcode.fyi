//#region src/handler.ts
var handler_default = { async fetch(req) {
	const url = new URL(req.url);
	return new Response(`marker-xyz789 ok path=${url.pathname} ts=${(/* @__PURE__ */ new Date()).toISOString()}`, {
		status: 200,
		headers: { "content-type": "text/plain" }
	});
} };

//#endregion
export { handler_default as default };