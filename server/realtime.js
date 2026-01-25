let ioRef = null;

export function setRealtimeIo(io) {
	ioRef = io;
}

export function emitToUser(userId, event, payload) {
	if (!ioRef) return false;
	ioRef.to(`user:${userId}`).emit(event, payload);
	return true;
}

