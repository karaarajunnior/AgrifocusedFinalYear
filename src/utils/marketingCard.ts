import { toast } from 'react-hot-toast';

export const generateMarketingCard = (farmer: any, product?: any) => {
    // In a real app, this would use a canvas or a service like Cloudinary
    // to generate a beautiful image with the farmer's QR code and heritage story.
    // For now, we generate a professional text summary that can be shared.
    
    const url = `${window.location.origin}/portfolio/${farmer.id}`;
    const message = `
🌿 *Verified Direct Source: ${farmer.name}*
📍 Location: ${farmer.location}
🛡️ Status: Identity & Quality Verified
${product ? `📦 Product: ${product.name}\n💰 Price: UGX ${product.price.toLocaleString()}\n` : ''}
"My mission is to provide premium grade crops directly to global partners."

View full journey and verify origin here:
${url}

Sourced via #AgriFocused - Eliminating Middlemen.
    `.trim();

    if (navigator.share) {
        navigator.share({
            title: `Heritage Story: ${farmer.name}`,
            text: message,
            url: url
        }).catch(() => {
            copyToClipboard(message);
        });
    } else {
        copyToClipboard(message);
    }
};

const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Professional Marketing Card copied to clipboard!');
};
