export function parseProductImages(images?: string[] | string | null): string[] {
	if (!images) return [];
	let list: string[] = [];
	if (Array.isArray(images)) {
		list = images.filter(Boolean);
	} else if (typeof images === "string") {
		try {
			const parsed = JSON.parse(images);
			list = Array.isArray(parsed) ? parsed.filter(Boolean) : [parsed].filter(Boolean);
		} catch {
			list = [images];
		}
	} else {
		list = [];
	}
	const apiUrl = import.meta.env.VITE_API_URL || "https://agrifocused-api.onrender.com/api";
	const baseUrl = import.meta.env.VITE_API_BASE_URL || apiUrl.replace(/\/api\/?$/, "");
	return list.map((img) => {
		if (typeof img === "string" && img.startsWith("/uploads/")) {
			return `${baseUrl}${img}`;
		}
		return img;
	});
}

export const getProductImageUrls = parseProductImages;
export const getProductImages = parseProductImages;

export function getPrimaryProductImage(images?: string[] | string | null): string | undefined {
	return parseProductImages(images)[0];
}
