import speakeasy from "speakeasy";
import qrcode from "qrcode";

export async function generateMfaSetup(email) {
	const secret = speakeasy.generateSecret({
		name: `AgriConnect (${email})`,
	});
	const qrCodeDataUrl = await qrcode.toDataURL(secret.otpauth_url);
	return {
		otpauthUrl: secret.otpauth_url,
		base32: secret.base32,
		qrCodeDataUrl,
	};
}

export function verifyTotp({ secretBase32, token }) {
	if (!secretBase32) return false;
	return speakeasy.totp.verify({
		secret: secretBase32,
		encoding: "base32",
		token,
		window: 1,
	});
}

