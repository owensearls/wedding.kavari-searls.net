import { createRemoteJWKSet, jwtVerify } from "jose";

interface Opts {
  aud: string;
  teamDomain: string;
}

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJwks(teamDomain: string) {
  const key = teamDomain;
  let jwks = jwksCache.get(key);
  if (!jwks) {
    jwks = createRemoteJWKSet(
      new URL(`https://${teamDomain}.cloudflareaccess.com/cdn-cgi/access/certs`),
    );
    jwksCache.set(key, jwks);
  }
  return jwks;
}

export async function verifyAccessJwt(request: Request, opts: Opts): Promise<boolean> {
  const jwt = request.headers.get("cf-access-jwt-assertion");
  if (!jwt) return false;
  try {
    await jwtVerify(jwt, getJwks(opts.teamDomain), {
      issuer: `https://${opts.teamDomain}.cloudflareaccess.com`,
      audience: opts.aud,
    });
    return true;
  } catch {
    return false;
  }
}
