// Cloudflare Worker to proxy GL Bajaj API requests
// Deploy this at: https://workers.cloudflare.com/
//
// This worker acts as a proxy to avoid CORS issues when accessing
// the GL Bajaj API from your frontend application.

export default {
  async fetch(request, env) {
    // Handle CORS preflight requests
    if (request.method === "OPTIONS") {
      return handleCORS(request);
    }

    // Configure allowed origins (update these with your domains)
    const allowedOrigins = [
      "https://yashmalik.tech",
      "https://itsrat17.github.io",
      "https://rachi.tech",
      "https://gportal.yashmalik.tech",
      "https://codeblech.github.io",
      "http://localhost:5173", // Local development
      "http://localhost:4173", // Vite preview
    ];

    const origin = request.headers.get("Origin");

    // Check if origin is allowed (also allow if no origin header for direct requests)
    if (origin && !allowedOrigins.includes(origin)) {
      console.log(`Blocked origin: ${origin}`);
      return new Response("Forbidden - Origin not allowed", { status: 403 });
    }

    try {
      const url = new URL(request.url);

      // Extract the path
      // e.g., /api/glbajaj/Login -> /ISIMGLB/Login
      // or /ISIMGLB/Login -> /ISIMGLB/Login (direct path, for handling redirects)
      let path;
      if (url.pathname.startsWith("/api/glbajaj")) {
        path = url.pathname.replace(/^\/api\/glbajaj/, "/ISIMGLB");
      } else if (url.pathname.startsWith("/ISIMGLB")) {
        path = url.pathname; // Keep as is
      } else {
        return new Response("Not Found - Invalid path", {
          status: 404,
          headers: {
            "Access-Control-Allow-Origin": origin,
          },
        });
      }

      // Construct the target URL
      const targetUrl = `https://glbg.servergi.com:8072${path}${url.search}`;

      console.log(`Proxying request to: ${targetUrl}`);

      // Clone the headers and ensure proper handling
      const requestHeaders = new Headers(request.headers);

      // Remove origin-specific headers that shouldn't be forwarded
      requestHeaders.delete("origin");
      requestHeaders.delete("referer");

      // Get request body for non-GET/HEAD methods
      let requestBody = null;
      if (request.method !== "GET" && request.method !== "HEAD") {
        // Read body as arrayBuffer to preserve all data types
        requestBody = await request.arrayBuffer();
      }

      // Forward the request to the GL Bajaj server
      const modifiedRequest = new Request(targetUrl, {
        method: request.method,
        headers: requestHeaders,
        body: requestBody,
      });

      // Make the request to the target server
      const response = await fetch(modifiedRequest);

      // Always get response as arrayBuffer to preserve Content-Type header
      // (using text() or other methods causes Response constructor to override Content-Type)
      const body = await response.arrayBuffer();

      // Rewrite Location header for redirects to use the proxy path
      let rewrittenLocation = null;
      const locationHeader = response.headers.get("location") || response.headers.get("Location");

      if (locationHeader) {
        console.log(`Original redirect location: ${locationHeader}`);

        // Convert absolute URLs to use the proxy path
        if (locationHeader.includes("glbg.servergi.com")) {
          try {
            const locationUrl = new URL(locationHeader);
            // Rewrite /ISIMGLB/* to /api/glbajaj/*
            rewrittenLocation = locationUrl.pathname.replace(/^\/ISIMGLB/, "/api/glbajaj");
            console.log(`Rewritten redirect location: ${rewrittenLocation}`);
          } catch (e) {
            console.error("Error parsing location URL:", e);
          }
        } else if (locationHeader.startsWith("/ISIMGLB")) {
          // Handle relative URLs that start with /ISIMGLB
          rewrittenLocation = locationHeader.replace(/^\/ISIMGLB/, "/api/glbajaj");
          console.log(`Rewritten redirect location: ${rewrittenLocation}`);
        }
      }

      // Build response headers - preserve original headers and add minimal CORS
      const finalHeaders = new Headers(response.headers);

      // Only add the essential CORS headers needed for actual responses
      finalHeaders.set("Access-Control-Allow-Origin", origin || "*");
      finalHeaders.set("Access-Control-Allow-Credentials", "true");
      finalHeaders.set("Access-Control-Expose-Headers", "Set-Cookie");

      // Update Location header if it was rewritten
      if (rewrittenLocation) {
        finalHeaders.set("Location", rewrittenLocation);
      }

      // Return the response with CORS headers
      return new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers: finalHeaders,
      });
    } catch (error) {
      console.error("Proxy error:", error);
      return new Response(
        JSON.stringify({
          error: "Proxy error",
          message: error.message,
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        }
      );
    }
  },
};

function handleCORS(request) {
  const allowedOrigins = [
    "https://yashmalik.tech",
    "https://itsrat17.github.io",
    "https://rachi.tech",
    "https://gportal.yashmalik.tech",
    "https://codeblech.github.io",
    "http://localhost:5173",
    "http://localhost:4173",
  ];

  const origin = request.headers.get("Origin");

  if (origin && !allowedOrigins.includes(origin)) {
    console.log(`CORS blocked origin: ${origin}`);
    return new Response("Forbidden", { status: 403 });
  }

  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin || "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, Cookie",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Max-Age": "86400",
    },
  });
}
