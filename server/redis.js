import Redis from "ioredis";

let redis = null;

export function getRedis() {
	if (redis) return redis;
	const url = process.env.REDIS_URL;
	if (!url) return null;

	redis = new Redis(url, {
		maxRetriesPerRequest: 2,
		enableReadyCheck: true,
	});

	redis.on("error", (err) => {
		console.error("Redis error:", err?.message || err);
	});

	return redis;
}

export async function redisGetJson(key) {
	const r = getRedis();
	if (!r) return null;
	const v = await r.get(key);
	if (!v) return null;
	try {
		return JSON.parse(v);
	} catch {
		return null;
	}
}

export async function redisSetJson(key, value, ttlSeconds) {
	const r = getRedis();
	if (!r) return false;
	const payload = JSON.stringify(value);
	if (ttlSeconds) {
		await r.set(key, payload, "EX", ttlSeconds);
	} else {
		await r.set(key, payload);
	}
	return true;
}

