/**
 * Every third-party origin this application calls.
 *
 * InterFAX is reached through a Cloudflare Tunnel rather than directly. Its edge
 * returns 401 before evaluating Basic auth when X-Forwarded-For contains an IPv6
 * address, which is how requests from Cloudflare Workers arrive. The tunnel sends
 * traffic through nginx, which removes X-Forwarded-For before proxying the request
 * to https://rest.interfax.net. Direct routing is safe only after InterFAX accepts
 * IPv6 client addresses correctly.
 */

export const INTERFAX_BASE_URL = "https://interfax.fax.direct"
export const POSTHOOK_SCHEDULE_URL = "https://api.posthook.io/v1/hooks"
