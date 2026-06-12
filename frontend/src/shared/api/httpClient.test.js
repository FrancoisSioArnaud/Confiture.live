import { beforeEach, describe, expect, it, vi } from "vitest";

import { request } from "./httpClient";

describe("httpClient", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  it("keeps the HTTP status when an error response contains HTML", async () => {
    fetch.mockResolvedValueOnce(new Response("<html>Bad Gateway</html>", {
      status: 500,
      headers: { "Content-Type": "text/html" },
    }));

    try {
      await request("/jams/1/");
      throw new Error("request should have failed");
    } catch (error) {
      expect(error).not.toBeInstanceOf(SyntaxError);
      expect(error).toMatchObject({
        status: 500,
        isNetworkError: false,
        data: { raw: "<html>Bad Gateway</html>" },
      });
    }
  });

  it("marks fetch rejections as network errors", async () => {
    fetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    await expect(request("/jams/1/")).rejects.toMatchObject({
      isNetworkError: true,
      message: "Failed to fetch",
    });
  });

  it("returns null for an empty successful response", async () => {
    fetch.mockResolvedValueOnce(new Response("", { status: 200 }));

    await expect(request("/jams/1/", { method: "DELETE" })).resolves.toBeNull();
  });
});
