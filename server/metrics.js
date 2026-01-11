import client from "prom-client";

const register = new client.Registry();

// Default process metrics (CPU, memory, event loop, GC if available)
client.collectDefaultMetrics({
	register,
	prefix: "agri_",
});

// Request metrics
const httpRequestDurationSeconds = new client.Histogram({
	name: "agri_http_request_duration_seconds",
	help: "HTTP request duration in seconds",
	labelNames: ["method", "route", "status_code"],
	buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
});

register.registerMetric(httpRequestDurationSeconds);

function getRouteLabel(req) {
	// Keep cardinality low: prefer express route templates when available
	const routePath = req.route?.path;
	if (routePath) return `${req.baseUrl || ""}${routePath}`;
	if (req.baseUrl) return req.baseUrl;
	return req.path || "unknown";
}

export function metricsMiddleware(req, res, next) {
	const end = httpRequestDurationSeconds.startTimer();
	res.on("finish", () => {
		end({
			method: req.method,
			route: getRouteLabel(req),
			status_code: String(res.statusCode),
		});
	});
	next();
}

export async function metricsHandler(req, res) {
	res.setHeader("Content-Type", register.contentType);
	res.end(await register.metrics());
}

export { register };

