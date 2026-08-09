/**
 * Every third-party origin this application calls.
 *
 * InterFAX is reached through a Cloudflare Tunnel rather than directly, because
 * its edge rejects Cloudflare's egress addresses: identical credentials return
 * 200 from a dedicated host and 401 from a Worker, and the rejection happens
 * before authentication is evaluated. The tunnel exits from a dedicated server
 * and forwards to https://rest.interfax.net unchanged, so paths and provider
 * behavior are identical. Point this back at the provider once InterFAX allows
 * requests from Cloudflare ranges.
 */

export const INTERFAX_BASE_URL = "https://interfax.fax.direct"
export const POSTHOOK_SCHEDULE_URL = "https://api.posthook.io/v1/hooks"
