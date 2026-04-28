export function parseProductImages(images?: string[] | string | null): string[] {
	if (!images) return [];
	if (Array.isArray(images)) return images.filter(Boolean);
	try {
		const parsed = JSON.parse(images);
		return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
	} catch {
		return [];
	}
}

export const getProductImageUrls = parseProductImages;
export const getProductImages = parseProductImages;

export function getPrimaryProductImage(images?: string[] | string | null): string | undefined {
	return parseProductImages(images)[0];
}
