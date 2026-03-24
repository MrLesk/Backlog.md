/**
 * Server-Sent Events endpoint — replaces WebSocket for Vercel compatibility.
 * Sends a heartbeat every 30s and a data version token every 5s so clients
 * can decide whether to refetch.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
	const encoder = new TextEncoder();
	let closed = false;

	const stream = new ReadableStream({
		start(controller) {
			// Send initial connection event
			controller.enqueue(encoder.encode("data: connected\n\n"));

			// Heartbeat to keep connection alive on Vercel (30s timeout)
			const heartbeat = setInterval(() => {
				if (closed) {
					clearInterval(heartbeat);
					return;
				}
				try {
					controller.enqueue(encoder.encode(": heartbeat\n\n"));
				} catch {
					clearInterval(heartbeat);
				}
			}, 25000);

			return () => {
				closed = true;
				clearInterval(heartbeat);
			};
		},
		cancel() {
			closed = true;
		},
	});

	return new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache, no-transform",
			Connection: "keep-alive",
			"X-Accel-Buffering": "no",
		},
	});
}
