import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {},
  async rewrites() {
    return [
      { source: "/api/state", destination: "/api/reviews-assistant/state" },
      { source: "/api/tutor-state", destination: "/api/reviews-assistant/tutor-state" },
      { source: "/api/review-attachment", destination: "/api/reviews-assistant/review-attachment" },
      { source: "/api/review-form/template", destination: "/api/reviews-assistant/review-form/template" },
      { source: "/api/review-form/word-template", destination: "/api/reviews-assistant/review-form/word-template" },
      { source: "/api/feedback", destination: "/api/reviews-assistant/feedback" },
      { source: "/api/tutor-reword", destination: "/api/reviews-assistant/tutor-reword" },
      { source: "/forms/:path*", destination: "/review-assistant/forms/:path*" },
    ];
  },
};

export default nextConfig;
