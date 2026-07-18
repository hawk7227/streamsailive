import { STREAMS_V1_ROUTE_INVENTORY } from "./v1-contract";

const bearerSecurity = [{ bearerAuth: [] }];

function genericPath(route: string) {
  return {
    get: {
      summary: `Read ${route}`,
      security: bearerSecurity,
      responses: {
        "200": { description: "Successful v1 response", content: { "application/json": { schema: { $ref: "#/components/schemas/SuccessEnvelope" } } } },
        "401": { description: "Authentication required", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } },
      },
    },
    post: {
      summary: `Create or execute ${route}`,
      security: bearerSecurity,
      requestBody: { required: false, content: { "application/json": { schema: { type: "object", additionalProperties: true } } } },
      responses: {
        "200": { description: "Successful v1 response", content: { "application/json": { schema: { $ref: "#/components/schemas/SuccessEnvelope" } } } },
        "201": { description: "Created", content: { "application/json": { schema: { $ref: "#/components/schemas/SuccessEnvelope" } } } },
        "400": { description: "Invalid request", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } },
        "401": { description: "Authentication required", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } },
        "409": { description: "Revision or idempotency conflict", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } },
      },
    },
    patch: {
      summary: `Update ${route}`,
      security: bearerSecurity,
      requestBody: { required: true, content: { "application/json": { schema: { type: "object", additionalProperties: true } } } },
      responses: {
        "200": { description: "Successful v1 response", content: { "application/json": { schema: { $ref: "#/components/schemas/SuccessEnvelope" } } } },
        "400": { description: "Invalid request", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } },
        "401": { description: "Authentication required", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } },
        "409": { description: "Revision conflict", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } },
      },
    },
  };
}

export function createStreamsV1OpenApiDocument(origin = "https://streamsailive.vercel.app") {
  return {
    openapi: "3.1.0",
    info: {
      title: "StreamsAI v1 API",
      version: "1.0.0",
      description: "Stable mobile-safe contracts over the existing StreamsAI projects, conversations, messages, jobs, events, assets, memory, settings, billing, usage, and builder services.",
    },
    servers: [{ url: origin }],
    security: bearerSecurity,
    paths: Object.fromEntries(STREAMS_V1_ROUTE_INVENTORY.map((route) => [route, genericPath(route)])),
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "Supabase access token" },
      },
      schemas: {
        SuccessEnvelope: {
          type: "object",
          required: ["ok", "apiVersion"],
          properties: {
            ok: { const: true },
            apiVersion: { const: "v1" },
          },
          additionalProperties: true,
        },
        ErrorEnvelope: {
          type: "object",
          required: ["ok", "apiVersion", "error"],
          properties: {
            ok: { const: false },
            apiVersion: { const: "v1" },
            error: { type: "string" },
            code: { type: "string" },
            details: {},
          },
          additionalProperties: true,
        },
      },
    },
    "x-streams-route-count": STREAMS_V1_ROUTE_INVENTORY.length,
  };
}
