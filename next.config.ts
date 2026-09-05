import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // fonts.ts loads DejaVu Sans from node_modules via a runtime-built path
  // (fs.readFileSync(path.join(process.cwd(), ...))) for PDF font embedding.
  // Next's build-time trace can't follow that dynamic path, so every PDF
  // export route needs the actual .ttf files listed explicitly here or
  // they're missing from the deployed serverless bundle.
  outputFileTracingIncludes: {
    "/*": ["node_modules/dejavu-fonts-ttf/ttf/DejaVuSans.ttf", "node_modules/dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf"],
  },
};

export default nextConfig;
