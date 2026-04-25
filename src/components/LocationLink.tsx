import { MapPin } from "lucide-react";
import { buildMapUrl, type MapLocation } from "../utils/maps";

interface LocationLinkProps extends MapLocation {
	className?: string;
	iconClassName?: string;
	label?: string;
	children?: React.ReactNode;
}

export default function LocationLink({
	location,
	latitude,
	longitude,
	label = "Open map",
	className = "inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 hover:underline",
	iconClassName = "h-4 w-4",
	children,
}: LocationLinkProps) {
	const url = buildMapUrl({ location, latitude, longitude });
	if (!url) return children ? <>{children}</> : null;

	return (
		<a
			href={url}
			target="_blank"
			rel="noopener noreferrer"
			className={className}
			title={latitude != null && longitude != null ? "Open exact GPS pin" : "Open location in map"}
			onClick={(event) => event.stopPropagation()}
		>
			<MapPin className={iconClassName} />
			{children || label}
		</a>
	);
}
